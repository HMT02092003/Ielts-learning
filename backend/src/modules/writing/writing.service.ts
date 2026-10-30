// Writing (spec §6 P5): per-task autosave with its own clientSeq (CAS), submit via the attempt, then an
// append-only list of evaluations (LIBRARY estimate now, LLM later, HUMAN by an admin).
import { createHash } from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { AppError, notFound } from '../../lib/errors';
import type { WritingEvaluator } from '../../lib/writing/evaluator';
import { createLibraryWritingEvaluator } from '../../lib/writing/library-evaluator';
import type { Role } from '../../shared/enums';
import {
  meanBand,
  WritingEvaluationResult,
  type HumanWritingReviewBody,
  type WritingEvaluationDto,
  type WritingSaveBody,
  type WritingSubmissionDto,
} from '../../shared/writing';
import { countWords } from '../../shared/primitives';
import { filterToScope, loadSection } from '../attempts/attempt-content.service';

interface Actor {
  id: string;
  role: Role;
}

const submissionInclude = {
  part: {
    select: {
      number: true,
      writingTask: { select: { kind: true, prompt: true, imageId: true, minWords: true } },
    },
  },
  attempt: { select: { test: { select: { title: true } } } },
  user: { select: { displayName: true } },
  evaluations: {
    orderBy: { createdAt: 'asc' },
    include: { reviewer: { select: { displayName: true } } },
  },
} satisfies Prisma.WritingSubmissionInclude;

type SubmissionRow = Prisma.WritingSubmissionGetPayload<{ include: typeof submissionInclude }>;

const iso = (d: Date | null) => d?.toISOString() ?? null;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function evaluationDto(e: SubmissionRow['evaluations'][number]): WritingEvaluationDto {
  return {
    id: e.id,
    evaluator: e.evaluator,
    evaluatorVersion: e.evaluatorVersion,
    status: e.status,
    isEstimate: e.isEstimate,
    bandTaskResponse: e.bandTaskResponse,
    bandCoherence: e.bandCoherence,
    bandLexical: e.bandLexical,
    bandGrammar: e.bandGrammar,
    bandOverall: e.bandOverall,
    result: WritingEvaluationResult.nullable().catch(null).parse(e.result),
    comment: e.comment,
    reviewerName: e.reviewer?.displayName ?? null,
    error: e.error,
    textHash: e.textHash,
    createdAt: e.createdAt.toISOString(),
  };
}

function toDto(s: SubmissionRow): WritingSubmissionDto {
  const task = s.part.writingTask;
  return {
    id: s.id,
    attemptId: s.attemptId,
    partId: s.partId,
    partNumber: s.part.number,
    testTitle: s.attempt.test.title,
    userName: s.user.displayName,
    taskKind: task?.kind ?? 'ESSAY',
    prompt: task?.prompt ?? '',
    imageId: task?.imageId ?? null,
    minWords: task?.minWords ?? 0,
    text: s.text,
    wordCount: s.wordCount,
    status: s.status,
    lastClientSeq: s.lastClientSeq,
    submittedAt: iso(s.submittedAt),
    selfChecklist:
      typeof s.selfChecklist === 'object' && s.selfChecklist !== null
        ? (s.selfChecklist as Record<string, boolean>)
        : {},
    evaluations: s.evaluations.map(evaluationDto),
  };
}

export function createWritingService(evaluator: WritingEvaluator = createLibraryWritingEvaluator()) {
  async function loadAttempt(id: string, actor: Actor, write = false) {
    const a = await prisma.attempt.findUnique({
      where: { id },
      include: { section: { select: { skill: true } } },
    });
    if (!a || (a.userId !== actor.id && (write || actor.role !== 'ADMIN'))) throw notFound('Bài làm');
    if (a.section.skill !== 'WRITING') throw new AppError('CONFLICT', 'Bài này không phải Writing');
    return a;
  }

  async function writingParts(a: Awaited<ReturnType<typeof loadAttempt>>) {
    const parts = filterToScope(await loadSection(a.sectionId), {
      scope: a.scope,
      partId: a.partId,
      questionTypes: a.questionTypes,
      questionNumbers: a.questionNumbers,
    });
    return parts.filter((p) => p.writingTask);
  }

  async function loadSubmission(id: string, actor: Actor) {
    const s = await prisma.writingSubmission.findUnique({ where: { id }, include: submissionInclude });
    if (!s || (s.userId !== actor.id && actor.role !== 'ADMIN')) throw notFound('Bài viết');
    return s;
  }

  /** Run one evaluation row to completion (never throws; failures are stored on the row). */
  async function runEvaluation(evaluationId: string) {
    const e = await prisma.writingEvaluation.update({
      where: { id: evaluationId },
      data: { status: 'RUNNING' },
      include: { submission: { include: { part: { select: { writingTask: true } } } } },
    });
    const task = e.submission.part.writingTask;
    try {
      const out = await evaluator.evaluate({
        text: e.submission.text,
        task: { kind: task?.kind ?? 'ESSAY', minWords: task?.minWords ?? 0, prompt: task?.prompt ?? '' },
        language: env.LANGUAGETOOL_LANG,
      });
      await prisma.writingEvaluation.update({
        where: { id: evaluationId },
        data: {
          status: 'DONE',
          evaluatorVersion: out.evaluatorVersion,
          bandTaskResponse: out.bands.taskResponse,
          bandCoherence: out.bands.coherence,
          bandLexical: out.bands.lexical,
          bandGrammar: out.bands.grammar,
          bandOverall: out.bands.overall,
          result: out.result,
        },
      });
    } catch (err) {
      logger.error({ err, evaluationId }, 'writing evaluation failed');
      await prisma.writingEvaluation.update({
        where: { id: evaluationId },
        data: { status: 'FAILED', error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  async function queueEvaluation(submissionId: string, text: string) {
    const e = await prisma.writingEvaluation.create({
      data: {
        submissionId,
        evaluator: evaluator.kind,
        evaluatorVersion: 'pending',
        status: 'PENDING',
        textHash: sha(text),
        language: env.LANGUAGETOOL_LANG,
        isEstimate: true,
      },
    });
    return e.id;
  }

  return {
    runEvaluation,

    /** Submissions of an attempt (rows are created on first read while the attempt is open). */
    async list(attemptId: string, actor: Actor): Promise<WritingSubmissionDto[]> {
      const a = await loadAttempt(attemptId, actor);
      const parts = await writingParts(a);
      if ((a.status === 'CREATED' || a.status === 'IN_PROGRESS') && a.userId === actor.id) {
        for (const p of parts) {
          await prisma.writingSubmission.upsert({
            where: { attemptId_partId: { attemptId, partId: p.id } },
            create: { attemptId, partId: p.id, userId: a.userId },
            update: {},
          });
        }
      }
      const rows = await prisma.writingSubmission.findMany({
        where: { attemptId },
        include: submissionInclude,
        orderBy: { part: { number: 'asc' } },
      });
      return rows.map(toDto);
    },

    async save(attemptId: string, partId: string, actor: Actor, body: WritingSaveBody) {
      const a = await loadAttempt(attemptId, actor, true);
      if (a.status !== 'IN_PROGRESS') throw new AppError('CONFLICT', 'Bài không còn mở để sửa');
      if (a.deadlineAt && Date.now() > a.deadlineAt.getTime() + env.ATTEMPT_GRACE_SECONDS * 1000) {
        throw new AppError('ATTEMPT_DEADLINE_PASSED', 'Đã hết giờ làm bài');
      }
      if (!(await writingParts(a)).some((p) => p.id === partId)) throw notFound('Task');
      const wordCount = countWords(body.text);
      await prisma.writingSubmission.upsert({
        where: { attemptId_partId: { attemptId, partId } },
        create: { attemptId, partId, userId: a.userId },
        update: {},
      });
      const r = await prisma.writingSubmission.updateMany({
        where: { attemptId, partId, lastClientSeq: { lt: body.clientSeq }, status: 'DRAFT' },
        data: { text: body.text, wordCount, lastClientSeq: body.clientSeq, lastSavedAt: new Date() },
      });
      if (r.count > 0)
        await prisma.attempt.update({ where: { id: attemptId }, data: { lastSavedAt: new Date() } });
      const row = await prisma.writingSubmission.findUniqueOrThrow({
        where: { attemptId_partId: { attemptId, partId } },
        select: { lastClientSeq: true, wordCount: true },
      });
      return {
        applied: r.count > 0,
        savedSeq: row.lastClientSeq,
        wordCount: row.wordCount,
        serverNow: new Date().toISOString(),
      };
    },

    /** Called by attempts.finalize for WRITING attempts: lock the texts and queue the estimate. */
    async onAttemptFinalized(attemptId: string, at: Date) {
      const rows = await prisma.writingSubmission.findMany({ where: { attemptId, status: 'DRAFT' } });
      const queued: string[] = [];
      for (const s of rows) {
        await prisma.writingSubmission.update({
          where: { id: s.id },
          data: { status: 'SUBMITTED', submittedAt: at, wordCount: countWords(s.text) },
        });
        queued.push(await queueEvaluation(s.id, s.text));
      }
      // Background: LanguageTool can take seconds; the result page polls while PENDING/RUNNING.
      void (async () => {
        for (const id of queued) await runEvaluation(id);
      })();
      return queued;
    },

    async get(id: string, actor: Actor) {
      return toDto(await loadSubmission(id, actor));
    },

    /** Re-run the machine estimate (e.g. after LanguageTool was down). */
    async reevaluate(id: string, actor: Actor) {
      const s = await loadSubmission(id, actor);
      if (s.status !== 'SUBMITTED') throw new AppError('CONFLICT', 'Bài chưa nộp');
      const evalId = await queueEvaluation(s.id, s.text);
      await runEvaluation(evalId);
      return toDto(await loadSubmission(id, actor));
    },

    async setChecklist(id: string, actor: Actor, checklist: Record<string, boolean>) {
      const s = await loadSubmission(id, actor);
      if (s.userId !== actor.id) throw notFound('Bài viết');
      await prisma.writingSubmission.update({ where: { id }, data: { selfChecklist: checklist } });
      return toDto(await loadSubmission(id, actor));
    },

    /** The student's submitted essays (history / compare), newest first; optional filter by task. */
    async listMine(actor: Actor, q: { partId?: string; page: number; pageSize: number }) {
      const where: Prisma.WritingSubmissionWhereInput = {
        userId: actor.id,
        status: 'SUBMITTED',
        ...(q.partId ? { partId: q.partId } : {}),
      };
      const [items, total] = await Promise.all([
        prisma.writingSubmission.findMany({
          where,
          include: submissionInclude,
          orderBy: { submittedAt: 'desc' },
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
        }),
        prisma.writingSubmission.count({ where }),
      ]);
      return { items: items.map(toDto), page: q.page, pageSize: q.pageSize, total };
    },

    async review(id: string, reviewer: Actor, body: HumanWritingReviewBody) {
      const s = await loadSubmission(id, reviewer);
      if (s.status !== 'SUBMITTED') throw new AppError('CONFLICT', 'Bài chưa nộp');
      await prisma.writingEvaluation.create({
        data: {
          submissionId: id,
          evaluator: 'HUMAN',
          evaluatorVersion: 'human',
          status: 'DONE',
          textHash: sha(s.text),
          isEstimate: false,
          bandTaskResponse: body.bandTaskResponse,
          bandCoherence: body.bandCoherence,
          bandLexical: body.bandLexical,
          bandGrammar: body.bandGrammar,
          bandOverall: meanBand([
            body.bandTaskResponse,
            body.bandCoherence,
            body.bandLexical,
            body.bandGrammar,
          ]),
          comment: body.comment || null,
          reviewerId: reviewer.id,
        },
      });
      return toDto(await loadSubmission(id, reviewer));
    },
  };
}

export const writingService = createWritingService();
