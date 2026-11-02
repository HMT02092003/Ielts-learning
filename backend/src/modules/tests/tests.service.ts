import path from 'node:path';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { Prisma } from '../../generated/prisma/client';
import { AppError, notFound } from '../../lib/errors';
import type {
  AdminListTestsQuery,
  HotfixQuestionBody,
  ImportResultDto,
  Paginated,
  TestSummaryDto,
  UpdateTestMetaBody,
} from '../../shared/admin';
import type { FilePurpose, Skill } from '../../shared/enums';
import { zodIssues } from '../../shared/errors';
import {
  checkPublishable,
  TestImportDoc as TestImportDocSchema,
  WorkingDoc,
  type FileRef,
  type TestImportDoc,
} from '../../shared/test-import';
import { filesService } from '../files/files.service';
import { exportTest } from './export.service';
import { importTest, parseTestImport, type FileResolver } from './import.service';

const summaryInclude = {
  sections: {
    select: {
      skill: true,
      _count: { select: { questions: true, parts: true } },
    },
  },
  _count: { select: { attempts: { where: { isPreview: false } } } },
} as const satisfies Prisma.TestInclude;

type SummaryRow = Omit<Prisma.TestGetPayload<{ include: typeof summaryInclude }>, 'workingDoc'>;

/** Summary queries never load the (possibly large) working document. */
const omitWorking = { workingDoc: true } as const;

const SKILL_ORDER: Skill[] = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'];

export function toSummary(t: SummaryRow): TestSummaryDto {
  return {
    id: t.id,
    seriesKey: t.seriesKey,
    version: t.version,
    status: t.status,
    source: t.source,
    type: t.type,
    title: t.title,
    sourceRef: t.sourceRef,
    bookNumber: t.bookNumber,
    testNumber: t.testNumber,
    sections: [...t.sections]
      .sort((a, b) => SKILL_ORDER.indexOf(a.skill) - SKILL_ORDER.indexOf(b.skill))
      .map((s) => ({ skill: s.skill, questions: s._count.questions, parts: s._count.parts })),
    attemptCount: t._count.attempts,
    publishedAt: t.publishedAt?.toISOString() ?? null,
    workingDocAt: t.workingDocAt?.toISOString() ?? null,
    updatedAt: t.updatedAt.toISOString(),
  };
}

export interface UploadedAsset {
  path: string;
  originalname: string;
}

/**
 * Resolve file references of an import document: { fileId } must exist with the right purpose; { path } is matched
 * by file name against the assets uploaded with the JSON (browsers send only the base name).
 */
export function adminFileResolver(assets: UploadedAsset[], uploadedById: string): FileResolver {
  const cache = new Map<string, string>();
  return async (ref: FileRef, purpose: FilePurpose, at: string) => {
    if ('fileId' in ref) {
      const f = await prisma.storedFile.findUnique({ where: { id: ref.fileId }, select: { purpose: true } });
      if (f?.purpose !== purpose) {
        throw new AppError('IMPORT_INVALID', 'File đề không hợp lệ', {
          issues: [
            { path: at, code: 'file_not_found', message: `Không có file ${purpose} với id ${ref.fileId}` },
          ],
        });
      }
      return ref.fileId;
    }
    const cached = cache.get(ref.path);
    if (cached) return cached;
    const base = path.posix.basename(ref.path);
    const asset = assets.find((a) => a.originalname === base || a.originalname === ref.path);
    if (!asset) {
      throw new AppError('IMPORT_INVALID', 'File đề không hợp lệ', {
        issues: [{ path: at, code: 'asset_missing', message: `Chưa upload file "${base}" kèm theo JSON` }],
      });
    }
    const stored = await filesService.ingest({ path: asset.path, purpose, originalName: base, uploadedById });
    cache.set(ref.path, stored.id);
    return stored.id;
  };
}

async function hasRealAttempts(testId: string): Promise<boolean> {
  return (await prisma.attempt.count({ where: { testId, isPreview: false } })) > 0;
}

function sectionsOf(doc: TestImportDoc): ImportResultDto['summary'] {
  const count = (groups: { questions: unknown[] }[]) => groups.reduce((n, g) => n + g.questions.length, 0);
  const sections: { skill: Skill; questions: number; parts: number }[] = [];
  if (doc.listening) {
    sections.push({
      skill: 'LISTENING',
      parts: doc.listening.parts.length,
      questions: count(doc.listening.parts.flatMap((p) => p.groups)),
    });
  }
  if (doc.reading) {
    sections.push({
      skill: 'READING',
      parts: doc.reading.passages.length,
      questions: count(doc.reading.passages.flatMap((p) => p.groups)),
    });
  }
  if (doc.writing) sections.push({ skill: 'WRITING', parts: doc.writing.tasks.length, questions: 0 });
  if (doc.speaking) sections.push({ skill: 'SPEAKING', parts: doc.speaking.parts.length, questions: 0 });
  return { sections };
}

/** Content can change only on a DRAFT test without real attempts (published tests are immutable, M1). */
async function editableDraft(id: string) {
  const t = await prisma.test.findUnique({ where: { id }, omit: omitWorking });
  if (!t) throw notFound('Đề');
  if (t.status !== 'DRAFT') {
    throw new AppError('TEST_LOCKED', 'Đề đã xuất bản không sửa nội dung được — hãy nhân bản thành bản mới');
  }
  if (await hasRealAttempts(id))
    throw new AppError('TEST_LOCKED', 'Đề đã có người làm, hãy nhân bản thành bản mới');
  return t;
}

function parseWorking(raw: unknown): WorkingDoc {
  const parsed = WorkingDoc.safeParse(raw);
  if (!parsed.success) {
    throw new AppError('IMPORT_INVALID', 'Thông tin đề chưa hợp lệ', { issues: zodIssues(parsed.error) });
  }
  if (JSON.stringify(parsed.data).length > env.IMPORT_MAX_JSON_MB * 1_048_576) {
    throw new AppError('FILE_TOO_LARGE', `Bản soạn vượt quá ${env.IMPORT_MAX_JSON_MB} MB`);
  }
  return parsed.data;
}

/** Test row metadata mirrored from the working document (the list and search show what is being edited). */
function workingMeta(doc: WorkingDoc) {
  return {
    title: doc.title,
    source: doc.source,
    type: doc.type,
    sourceRef: doc.sourceRef ?? null,
    bookNumber: doc.bookNumber ?? null,
    testNumber: doc.testNumber ?? null,
    description: doc.description ?? null,
  };
}

/** Issues of a working document: the full schema first, then the publish checks. */
function workingIssues(doc: unknown) {
  const parsed = TestImportDocSchema.safeParse(doc);
  if (!parsed.success) return zodIssues(parsed.error);
  return checkPublishable(parsed.data);
}

export const testsService = {
  async list(q: AdminListTestsQuery): Promise<Paginated<TestSummaryDto>> {
    const where: Prisma.TestWhereInput = {
      ...(q.source ? { source: q.source } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.skill ? { sections: { some: { skill: q.skill } } } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { seriesKey: { contains: q.q, mode: 'insensitive' } },
              { sourceRef: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.test.findMany({
        where,
        include: summaryInclude,
        omit: omitWorking,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.test.count({ where }),
    ]);
    return { items: rows.map(toSummary), page: q.page, pageSize: q.pageSize, total };
  },

  /** While the builder holds an unfinished working document, it is what the admin screens edit. */
  async get(id: string): Promise<{ test: TestSummaryDto; doc: unknown; publishIssues: unknown[] }> {
    const t = await prisma.test.findUnique({ where: { id }, include: summaryInclude });
    if (!t) throw notFound('Đề');
    if (t.workingDoc !== null) {
      return { test: toSummary(t), doc: t.workingDoc, publishIssues: workingIssues(t.workingDoc) };
    }
    const doc = await exportTest(id);
    return { test: toSummary(t), doc, publishIssues: checkPublishable(doc) };
  },

  /** Builder: create a DRAFT test from an unfinished document (no content tables yet). */
  async createWorking(raw: unknown, actorId: string): Promise<ImportResultDto> {
    const doc = parseWorking(raw);
    const last = await prisma.test.findFirst({
      where: { seriesKey: doc.seriesKey },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const t = await prisma.test.create({
      data: {
        ...workingMeta(doc),
        seriesKey: doc.seriesKey,
        version: (last?.version ?? 0) + 1,
        status: 'DRAFT',
        createdById: actorId,
        workingDoc: doc as Prisma.InputJsonValue,
        workingDocAt: new Date(),
      },
      select: { id: true },
    });
    return { valid: true, testId: t.id };
  },

  /** Builder: save an unfinished document on a DRAFT test; the content tables stay as they are. */
  async saveWorking(id: string, raw: unknown): Promise<TestSummaryDto> {
    const t = await editableDraft(id);
    const doc = parseWorking(raw);
    if (doc.seriesKey !== t.seriesKey) {
      throw new AppError('IMPORT_INVALID', 'File đề không hợp lệ', {
        issues: [{ path: 'seriesKey', code: 'immutable', message: `seriesKey phải giữ là "${t.seriesKey}"` }],
      });
    }
    const updated = await prisma.test.update({
      where: { id },
      data: { ...workingMeta(doc), workingDoc: doc as Prisma.InputJsonValue, workingDocAt: new Date() },
      include: summaryInclude,
      omit: omitWorking,
    });
    return toSummary(updated);
  },

  /** Builder: drop the unfinished document and go back to the stored content. */
  async discardWorking(id: string): Promise<TestSummaryDto> {
    const t = await prisma.test.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw notFound('Đề');
    const updated = await prisma.test.update({
      where: { id },
      data: { workingDoc: Prisma.DbNull, workingDocAt: null },
      include: summaryInclude,
      omit: omitWorking,
    });
    return toSummary(updated);
  },

  /** Dry run: validation only, nothing is stored. */
  validate(raw: unknown): ImportResultDto {
    const doc = parseTestImport(raw, { requirePublishable: false });
    return { valid: true, summary: sectionsOf(doc) };
  },

  async importNew(raw: unknown, assets: UploadedAsset[], actorId: string): Promise<ImportResultDto> {
    const doc = parseTestImport(raw, { requirePublishable: false });
    const last = await prisma.test.findFirst({
      where: { seriesKey: doc.seriesKey },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const { testId } = await importTest(doc, {
      status: 'DRAFT',
      resolveFile: adminFileResolver(assets, actorId),
      createdById: actorId,
      version: (last?.version ?? 0) + 1,
    });
    return { valid: true, testId, summary: sectionsOf(doc) };
  },

  /** JSON editor: only DRAFT tests without real attempts can change content (published ones are immutable, M1). */
  async replaceContent(id: string, raw: unknown, actorId: string): Promise<ImportResultDto> {
    const t = await editableDraft(id);
    const doc = parseTestImport(raw, { requirePublishable: false });
    if (doc.seriesKey !== t.seriesKey) {
      throw new AppError('IMPORT_INVALID', 'File đề không hợp lệ', {
        issues: [{ path: 'seriesKey', code: 'immutable', message: `seriesKey phải giữ là "${t.seriesKey}"` }],
      });
    }
    await prisma.attempt.deleteMany({ where: { testId: id, isPreview: true } });
    await importTest(doc, {
      status: 'DRAFT',
      resolveFile: adminFileResolver([], actorId),
      createdById: actorId,
      replaceTestId: id,
    });
    return { valid: true, testId: id, summary: sectionsOf(doc) };
  },

  async updateMeta(id: string, body: UpdateTestMetaBody): Promise<TestSummaryDto> {
    const exists = await prisma.test.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('Đề');
    const t = await prisma.test.update({ where: { id }, data: body, include: summaryInclude });
    return toSummary(t);
  },

  /** Publish = full "publishable" checks; older published versions of the same series become ARCHIVED. */
  async publish(id: string, actorId: string): Promise<TestSummaryDto> {
    const t = await prisma.test.findUnique({ where: { id }, omit: omitWorking });
    if (!t) throw notFound('Đề');
    if (t.status === 'PUBLISHED') return this.get(id).then((r) => r.test);
    if (t.workingDocAt) {
      throw new AppError('TEST_NOT_PUBLISHABLE', 'Đề chưa đủ điều kiện xuất bản', {
        issues: [
          {
            path: '',
            code: 'working_doc',
            message:
              'Còn bản soạn dở chưa hoàn chỉnh — hoàn thành và lưu vào đề (hoặc bỏ bản soạn dở) trước khi xuất bản',
          },
        ],
      });
    }
    const doc = parseTestImport(await exportTest(id), { requirePublishable: false });
    const issues = checkPublishable(doc);
    if (issues.length > 0)
      throw new AppError('TEST_NOT_PUBLISHABLE', 'Đề chưa đủ điều kiện xuất bản', { issues });
    await prisma.$transaction([
      prisma.test.updateMany({
        where: { seriesKey: t.seriesKey, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED', publishedSeriesKey: null },
      }),
      prisma.test.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedSeriesKey: t.seriesKey,
          publishedAt: new Date(),
          publishedById: actorId,
        },
      }),
    ]);
    return this.get(id).then((r) => r.test);
  },

  async unpublish(id: string): Promise<TestSummaryDto> {
    const t = await prisma.test.findUnique({ where: { id } });
    if (!t) throw notFound('Đề');
    await prisma.test.update({ where: { id }, data: { status: 'DRAFT', publishedSeriesKey: null } });
    return this.get(id).then((r) => r.test);
  },

  /** New DRAFT version with the same content (the way to change a published test). */
  async clone(id: string, actorId: string): Promise<ImportResultDto> {
    const t = await prisma.test.findUnique({ where: { id } });
    if (!t) throw notFound('Đề');
    const doc = parseTestImport(await exportTest(id), { requirePublishable: false });
    const last = await prisma.test.findFirst({
      where: { seriesKey: t.seriesKey },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const { testId } = await importTest(doc, {
      status: 'DRAFT',
      resolveFile: adminFileResolver([], actorId),
      createdById: actorId,
      version: (last?.version ?? 0) + 1,
    });
    return { valid: true, testId, summary: sectionsOf(doc) };
  },

  async remove(id: string): Promise<void> {
    const t = await prisma.test.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw notFound('Đề');
    if (await hasRealAttempts(id)) throw new AppError('TEST_LOCKED', 'Đề đã có người làm, không xóa được');
    await prisma.$transaction([
      prisma.attempt.deleteMany({ where: { testId: id, isPreview: true } }),
      prisma.test.delete({ where: { id } }),
    ]);
  },

  /** Question list with ids (for the hotfix table on the admin test page). */
  async questions(testId: string) {
    const rows = await prisma.question.findMany({
      where: { section: { testId } },
      select: {
        id: true,
        number: true,
        acceptedAnswers: true,
        explanation: true,
        correctAnswer: true,
        section: { select: { skill: true } },
        group: { select: { type: true } },
      },
      orderBy: [{ section: { skill: 'asc' } }, { number: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      skill: r.section.skill,
      number: r.number,
      type: r.group.type,
      correctAnswer: r.correctAnswer,
      acceptedAnswers: r.acceptedAnswers,
      explanation: r.explanation,
    }));
  },

  /** M1 hotfix on any status: answer variants / explanation only. Re-scoring happens through scoring (Phase 4). */
  async hotfixQuestion(testId: string, questionId: string, body: HotfixQuestionBody): Promise<void> {
    const q = await prisma.question.findFirst({
      where: { id: questionId, section: { testId } },
      select: { id: true },
    });
    if (!q) throw notFound('Câu hỏi');
    await prisma.question.update({
      where: { id: questionId },
      data: {
        ...(body.acceptedAnswers ? { acceptedAnswers: body.acceptedAnswers } : {}),
        ...(body.explanation !== undefined ? { explanation: body.explanation } : {}),
      },
    });
  },
};
