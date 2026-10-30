import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { AppError, notFound } from '../../lib/errors';
import { overallMethod, reocrImage, runOcr } from '../../lib/ocr/pipeline';
import {
  OcrBlock,
  OcrReviewDraft,
  type AssembleMeta,
  type OcrJobDetailDto,
  type OcrJobDto,
  type ReviewBlock,
  type SaveReviewBody,
} from '../../shared/ocr';
import { checkPublishable } from '../../shared/test-import';
import { filesService } from '../files/files.service';
import { importTest, parseTestImport } from '../tests/import.service';
import { adminFileResolver } from '../tests/tests.service';
import { assembleDoc, guessTags } from './assemble';

const MB = 1_048_576;

type JobRow = Prisma.OcrJobGetPayload<object>;

function toDto(j: JobRow): OcrJobDto {
  return {
    id: j.id,
    title: j.title,
    status: j.status,
    method: j.method,
    progress: j.progress,
    attempts: j.attempts,
    pageCount: j.pageCount,
    meanConfidence: j.meanConfidence,
    lastError: j.lastError,
    draftVersion: j.draftVersion,
    importedTestId: j.importedTestId,
    createdAt: j.createdAt.toISOString(),
    finishedAt: j.finishedAt?.toISOString() ?? null,
  };
}

function initialDraft(pages: { pageNumber: number; blocks: OcrBlock[] }[]): OcrReviewDraft {
  const flat = pages.flatMap((p) => p.blocks.map((b) => ({ page: p.pageNumber, b })));
  const tags = guessTags(flat.map((x) => x.b.text));
  const blocks: ReviewBlock[] = flat.map(({ page, b }, i) => ({
    id: `p${page}-${b.id}`,
    pageNumber: page,
    sourceIds: [b.id],
    tag: tags[i] ?? 'PASSAGE',
    text: b.text,
  }));
  return { blocks, answerKey: {} };
}

export const ocrService = {
  /** 1 PDF, or 1–30 images in page order (file names sort the pages). */
  async create(
    files: { path: string; originalname: string; size: number }[],
    title: string | undefined,
    actorId: string,
  ): Promise<OcrJobDto> {
    const sorted = [...files].sort((a, b) =>
      a.originalname.localeCompare(b.originalname, 'en', { numeric: true }),
    );
    const stored = [];
    for (const f of sorted) {
      const s = await filesService.ingest({
        path: f.path,
        purpose: 'OCR_SOURCE',
        originalName: f.originalname,
        uploadedById: actorId,
      });
      const limit = s.mimeType === 'application/pdf' ? env.UPLOAD_MAX_PDF_MB : env.UPLOAD_MAX_IMAGE_MB;
      if (s.sizeBytes > limit * MB)
        throw new AppError('FILE_TOO_LARGE', `"${f.originalname}" vượt quá ${limit} MB`);
      stored.push(s);
    }
    const pdfs = stored.filter((s) => s.mimeType === 'application/pdf');
    if (pdfs.length > 1 || (pdfs.length === 1 && stored.length > 1)) {
      throw new AppError('VALIDATION_ERROR', 'Mỗi lần chỉ nhận 1 file PDF, hoặc tối đa 30 ảnh');
    }
    const job = await prisma.ocrJob.create({
      data: {
        title: title ?? sorted[0]?.originalname ?? null,
        // Same clock as the claim query in processNext (the DB clock may run slightly ahead).
        runAfter: new Date(),
        createdById: actorId,
        sources: { create: stored.map((s, i) => ({ fileId: s.id, pageOrder: i + 1 })) },
      },
    });
    return toDto(job);
  },

  /** Worker tick: claim the oldest due job (compare-and-set), run the pipeline, store pages. */
  async processNext(signal: AbortSignal): Promise<boolean> {
    const now = new Date();
    const next = await prisma.ocrJob.findFirst({
      where: { status: 'QUEUED', runAfter: { lte: now } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!next) return false;
    const claimed = await prisma.ocrJob.updateMany({
      where: { id: next.id, status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: now, attempts: { increment: 1 }, progress: 0, lastError: null },
    });
    if (claimed.count !== 1) return true;

    const job = await prisma.ocrJob.findUniqueOrThrow({
      where: { id: next.id },
      include: { sources: { orderBy: { pageOrder: 'asc' }, include: { file: true } } },
    });
    const jobSignal = AbortSignal.any([signal, AbortSignal.timeout(env.OCR_JOB_TIMEOUT_MS)]);
    try {
      const sources = await Promise.all(
        job.sources.map(async (s) => ({
          bytes: await filesService.readBuffer(s.file),
          mimeType: s.file.mimeType,
        })),
      );
      let lastProgress = 0;
      const pages = await runOcr(sources, {
        signal: jobSignal,
        onProgress: (done, total) => {
          if (Date.now() - lastProgress < 2000) return;
          lastProgress = Date.now();
          void prisma.ocrJob.update({ where: { id: job.id }, data: { progress: done / Math.max(total, 1) } });
        },
      });
      await prisma.ocrPage.deleteMany({ where: { jobId: job.id } });
      const pageRows = [];
      for (const [i, p] of pages.entries()) {
        const img = await filesService.storeGenerated({
          bytes: p.image,
          purpose: 'OCR_PAGE',
          ext: 'png',
          mimeType: 'image/png',
          widthPx: p.widthPx,
          heightPx: p.heightPx,
          uploadedById: job.createdById,
        });
        pageRows.push(
          await prisma.ocrPage.create({
            data: {
              jobId: job.id,
              pageNumber: i + 1,
              imageFileId: img.id,
              widthPx: p.widthPx,
              heightPx: p.heightPx,
              method: p.method,
              meanConfidence: p.meanConfidence,
              blocks: p.blocks,
            },
          }),
        );
      }
      const confidences = pages.map((p) => p.meanConfidence).filter((c): c is number => c !== null);
      await prisma.ocrJob.update({
        where: { id: job.id },
        data: {
          status: 'NEEDS_REVIEW',
          progress: 1,
          method: overallMethod(pages),
          pageCount: pages.length,
          rawText: pages.map((p) => p.blocks.map((b) => b.text).join('\n\n')).join('\n\n\f\n\n'),
          meanConfidence: confidences.length
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : null,
          reviewDraft: initialDraft(
            pageRows.map((r, i) => ({ pageNumber: r.pageNumber, blocks: pages[i]?.blocks ?? [] })),
          ) as Prisma.InputJsonValue,
          draftVersion: { increment: 1 },
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      const message = (err as Error).message.slice(0, 500);
      const giveUp = job.attempts >= env.OCR_MAX_ATTEMPTS;
      logger.warn({ jobId: job.id, err: message, giveUp }, 'ocr job failed');
      await prisma.ocrJob.update({
        where: { id: job.id },
        data: giveUp
          ? { status: 'FAILED', lastError: message, finishedAt: new Date() }
          : {
              status: 'QUEUED',
              lastError: message,
              runAfter: new Date(Date.now() + 30_000 * 2 ** (job.attempts - 1)),
            },
      });
    }
    return true;
  },

  /** On boot: a job left RUNNING was interrupted (single process) — queue it again. */
  async resetInterrupted(): Promise<void> {
    await prisma.ocrJob.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'QUEUED', runAfter: new Date() },
    });
  },

  async list(q: { page: number; pageSize: number }) {
    const [rows, total] = await Promise.all([
      prisma.ocrJob.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.ocrJob.count(),
    ]);
    return { items: rows.map(toDto), page: q.page, pageSize: q.pageSize, total };
  },

  async get(id: string): Promise<OcrJobDetailDto> {
    const j = await prisma.ocrJob.findUnique({
      where: { id },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
    });
    if (!j) throw notFound('Job OCR');
    const draft = j.reviewDraft ? OcrReviewDraft.safeParse(j.reviewDraft) : null;
    return {
      ...toDto(j),
      pages: j.pages.map((p) => ({
        id: p.id,
        pageNumber: p.pageNumber,
        imageFileId: p.imageFileId,
        widthPx: p.widthPx,
        heightPx: p.heightPx,
        rotation: p.rotation,
        method: p.method,
        meanConfidence: p.meanConfidence,
        blocks: OcrBlock.array().parse(p.blocks),
        reviewStatus: p.reviewStatus,
      })),
      reviewDraft: draft?.success ? draft.data : null,
    };
  },

  /** Whole-draft save with optimistic concurrency (two tabs cannot silently overwrite each other). */
  async saveReview(id: string, body: SaveReviewBody): Promise<{ draftVersion: number }> {
    const j = await prisma.ocrJob.findUnique({ where: { id }, select: { status: true } });
    if (!j) throw notFound('Job OCR');
    if (j.status !== 'NEEDS_REVIEW') throw new AppError('OCR_JOB_NOT_READY', 'Job chưa sẵn sàng để review');
    const res = await prisma.ocrJob.updateMany({
      where: { id, draftVersion: body.draftVersion },
      data: { reviewDraft: body.draft as Prisma.InputJsonValue, draftVersion: { increment: 1 } },
    });
    if (res.count !== 1) {
      throw new AppError('CONFLICT', 'Bản nháp đã được lưu ở tab khác — tải lại trang', {
        reason: 'DRAFT_VERSION',
      });
    }
    return { draftVersion: body.draftVersion + 1 };
  },

  /** Rotate a page image and OCR it again; its blocks in the draft are replaced. */
  async rotatePage(
    jobId: string,
    pageId: string,
    rotation: number,
    actorId: string,
  ): Promise<OcrJobDetailDto> {
    const page = await prisma.ocrPage.findFirst({
      where: { id: pageId, jobId },
      include: { imageFile: true },
    });
    if (!page) throw notFound('Trang');
    const delta = (rotation - page.rotation + 360) % 360;
    const result = await reocrImage(await filesService.readBuffer(page.imageFile), delta);
    const img = await filesService.storeGenerated({
      bytes: result.image,
      purpose: 'OCR_PAGE',
      ext: 'png',
      mimeType: 'image/png',
      widthPx: result.widthPx,
      heightPx: result.heightPx,
      uploadedById: actorId,
    });
    await prisma.ocrPage.update({
      where: { id: pageId },
      data: {
        imageFileId: img.id,
        rotation,
        widthPx: result.widthPx,
        heightPx: result.heightPx,
        method: 'TESSERACT',
        meanConfidence: result.meanConfidence,
        blocks: result.blocks,
        reviewStatus: 'PENDING',
      },
    });
    const job = await prisma.ocrJob.findUniqueOrThrow({ where: { id: jobId } });
    const draft = OcrReviewDraft.safeParse(job.reviewDraft);
    if (draft.success) {
      const fresh = initialDraft([{ pageNumber: page.pageNumber, blocks: result.blocks }]).blocks;
      const others = draft.data.blocks.filter((b) => b.pageNumber !== page.pageNumber);
      const blocks = [...others, ...fresh].sort((a, b) => a.pageNumber - b.pageNumber);
      await prisma.ocrJob.update({
        where: { id: jobId },
        data: {
          reviewDraft: { ...draft.data, blocks } as Prisma.InputJsonValue,
          draftVersion: { increment: 1 },
        },
      });
    }
    return this.get(jobId);
  },

  async approvePage(jobId: string, pageId: string): Promise<void> {
    const res = await prisma.ocrPage.updateMany({
      where: { id: pageId, jobId },
      data: { reviewStatus: 'APPROVED', reviewedAt: new Date() },
    });
    if (res.count !== 1) throw notFound('Trang');
  },

  /** Build the draft test document from tagged blocks + answer key and report what is still invalid. */
  async assemble(id: string, meta: AssembleMeta) {
    const job = await prisma.ocrJob.findUnique({ where: { id } });
    if (!job) throw notFound('Job OCR');
    const draft = OcrReviewDraft.safeParse(job.reviewDraft);
    if (!draft.success) throw new AppError('OCR_JOB_NOT_READY', 'Chưa có bản nháp review');
    const doc = assembleDoc(draft.data.blocks, draft.data.answerKey, meta);
    await prisma.ocrJob.update({
      where: { id },
      data: { reviewDraft: { ...draft.data, doc } as Prisma.InputJsonValue, draftVersion: { increment: 1 } },
    });
    return { doc, issues: validateDoc(doc) };
  },

  /** Creates a DRAFT test (M5) — or publishes right away when asked and the document is publishable. */
  async publish(id: string, publishNow: boolean, actorId: string) {
    const job = await prisma.ocrJob.findUnique({ where: { id } });
    if (!job) throw notFound('Job OCR');
    if (job.status !== 'NEEDS_REVIEW')
      throw new AppError('OCR_JOB_NOT_READY', 'Job chưa sẵn sàng hoặc đã nhập');
    const draft = OcrReviewDraft.safeParse(job.reviewDraft);
    if (!draft.success || draft.data.doc === undefined) {
      throw new AppError('OCR_JOB_NOT_READY', 'Hãy dựng đề (Assemble) và sửa JSON trước khi publish');
    }
    const doc = parseTestImport(draft.data.doc, { requirePublishable: publishNow });
    const last = await prisma.test.findFirst({
      where: { seriesKey: doc.seriesKey },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const { testId } = await importTest(doc, {
      status: publishNow && checkPublishable(doc).length === 0 && !last ? 'PUBLISHED' : 'DRAFT',
      resolveFile: adminFileResolver([], actorId),
      createdById: actorId,
      version: (last?.version ?? 0) + 1,
    });
    await prisma.ocrJob.update({ where: { id }, data: { status: 'IMPORTED', importedTestId: testId } });
    return { testId };
  },

  async retry(id: string): Promise<OcrJobDto> {
    const j = await prisma.ocrJob.findUnique({ where: { id } });
    if (!j) throw notFound('Job OCR');
    if (j.status !== 'FAILED') throw new AppError('CONFLICT', 'Chỉ chạy lại được job bị lỗi');
    return toDto(
      await prisma.ocrJob.update({
        where: { id },
        data: { status: 'QUEUED', attempts: 0, runAfter: new Date(), lastError: null },
      }),
    );
  },

  async remove(id: string): Promise<void> {
    const j = await prisma.ocrJob.findUnique({
      where: { id },
      include: { sources: { select: { fileId: true } }, pages: { select: { imageFileId: true } } },
    });
    if (!j) throw notFound('Job OCR');
    if (j.status === 'RUNNING') throw new AppError('CONFLICT', 'Job đang chạy, đợi xong rồi xóa');
    await prisma.ocrJob.delete({ where: { id } });
    for (const fileId of [...j.sources.map((s) => s.fileId), ...j.pages.map((p) => p.imageFileId)]) {
      await filesService.remove(fileId).catch(() => undefined); // still referenced elsewhere → keep
    }
  },
};

function validateDoc(doc: unknown) {
  try {
    const parsed = parseTestImport(doc, { requirePublishable: false });
    return checkPublishable(parsed);
  } catch (err) {
    if (err instanceof AppError) {
      const details = err.details as { issues?: unknown[] } | undefined;
      return details?.issues ?? [{ path: '', code: err.code, message: err.message }];
    }
    throw err;
  }
}
