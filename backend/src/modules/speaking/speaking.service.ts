// Speaking (spec §6 P5): recordings uploaded per part (MediaRecorder webm/ogg/mp4/wav, magic bytes checked by
// files.service), admin feedback as HUMAN evaluations. SpeakingEvaluator (AI) is an interface only.
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../lib/errors';
import type { Role } from '../../shared/enums';
import { meanBand, type HumanSpeakingReviewBody, type SpeakingAttemptDto } from '../../shared/writing';
import { filterToScope, loadSection } from '../attempts/attempt-content.service';
import { filesService } from '../files/files.service';

interface Actor {
  id: string;
  role: Role;
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

async function loadAttempt(id: string, actor: Actor, write = false) {
  const a = await prisma.attempt.findUnique({
    where: { id },
    include: {
      section: { select: { skill: true } },
      test: { select: { title: true } },
      user: { select: { displayName: true } },
    },
  });
  if (!a || (a.userId !== actor.id && (write || actor.role !== 'ADMIN'))) throw notFound('Bài làm');
  if (a.section.skill !== 'SPEAKING') throw new AppError('CONFLICT', 'Bài này không phải Speaking');
  return a;
}

export const speakingService = {
  async get(attemptId: string, actor: Actor): Promise<SpeakingAttemptDto> {
    const a = await loadAttempt(attemptId, actor);
    const [recordings, evaluations] = await Promise.all([
      prisma.speakingRecording.findMany({
        where: { attemptId },
        include: { part: { select: { number: true } }, file: { select: { mimeType: true } } },
        orderBy: [{ part: { number: 'asc' } }, { questionIndex: 'asc' }, { take: 'asc' }],
      }),
      prisma.speakingEvaluation.findMany({
        where: { attemptId },
        include: { reviewer: { select: { displayName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      attemptId,
      testTitle: a.test.title,
      userName: a.user.displayName,
      status: a.status,
      submittedAt: iso(a.submittedAt),
      recordings: recordings.map((r) => ({
        id: r.id,
        partId: r.partId,
        partNumber: r.part.number,
        questionIndex: r.questionIndex,
        take: r.take,
        fileId: r.fileId,
        mimeType: r.file.mimeType,
        durationMs: r.durationMs,
        createdAt: r.createdAt.toISOString(),
      })),
      evaluations: evaluations.map((e) => ({
        id: e.id,
        evaluator: e.evaluator,
        isEstimate: e.isEstimate,
        bandFluency: e.bandFluency,
        bandLexical: e.bandLexical,
        bandGrammar: e.bandGrammar,
        bandPronunciation: e.bandPronunciation,
        bandOverall: e.bandOverall,
        comment: e.comment,
        reviewerName: e.reviewer?.displayName ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  },

  async upload(
    attemptId: string,
    actor: Actor,
    file: { path: string; originalname: string },
    fields: { partId: string; questionIndex: number; durationMs?: number },
  ) {
    const a = await loadAttempt(attemptId, actor, true);
    if (a.status !== 'IN_PROGRESS') throw new AppError('CONFLICT', 'Bài không còn mở để ghi âm');
    const parts = filterToScope(await loadSection(a.sectionId), {
      scope: a.scope,
      partId: a.partId,
      questionTypes: a.questionTypes,
      questionNumbers: a.questionNumbers,
    });
    if (!parts.some((p) => p.id === fields.partId && p.speakingPart)) throw notFound('Part');
    const stored = await filesService.ingest({
      path: file.path,
      purpose: 'SPEAKING_RECORDING',
      originalName: file.originalname,
      uploadedById: actor.id,
    });
    const last = await prisma.speakingRecording.findFirst({
      where: { attemptId, partId: fields.partId, questionIndex: fields.questionIndex },
      orderBy: { take: 'desc' },
      select: { take: true },
    });
    await prisma.speakingRecording.create({
      data: {
        attemptId,
        partId: fields.partId,
        userId: actor.id,
        questionIndex: fields.questionIndex,
        take: (last?.take ?? 0) + 1,
        fileId: stored.id,
        durationMs: fields.durationMs ?? null,
      },
    });
    await prisma.attempt.update({ where: { id: attemptId }, data: { lastSavedAt: new Date() } });
    return this.get(attemptId, actor);
  },

  async removeRecording(id: string, actor: Actor) {
    const r = await prisma.speakingRecording.findUnique({
      where: { id },
      include: { attempt: { select: { status: true } } },
    });
    if (!r || r.userId !== actor.id) throw notFound('Bản ghi');
    if (r.attempt.status !== 'IN_PROGRESS')
      throw new AppError('CONFLICT', 'Bài đã nộp, không xóa được bản ghi');
    await prisma.speakingRecording.delete({ where: { id } });
  },

  async review(attemptId: string, reviewer: Actor, body: HumanSpeakingReviewBody) {
    const a = await loadAttempt(attemptId, reviewer);
    if (a.status !== 'SUBMITTED' && a.status !== 'EXPIRED') throw new AppError('CONFLICT', 'Bài chưa nộp');
    await prisma.speakingEvaluation.create({
      data: {
        attemptId,
        evaluator: 'HUMAN',
        evaluatorVersion: 'human',
        status: 'DONE',
        isEstimate: false,
        bandFluency: body.bandFluency,
        bandLexical: body.bandLexical,
        bandGrammar: body.bandGrammar,
        bandPronunciation: body.bandPronunciation,
        bandOverall: meanBand([body.bandFluency, body.bandLexical, body.bandGrammar, body.bandPronunciation]),
        comment: body.comment || null,
        reviewerId: reviewer.id,
      },
    });
    return this.get(attemptId, reviewer);
  },
};
