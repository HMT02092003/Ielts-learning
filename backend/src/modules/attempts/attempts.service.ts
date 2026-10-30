import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../config/prisma';
import { Prisma } from '../../generated/prisma/client';
import { systemClock, type Clock } from '../../lib/clock';
import { AppError, notFound } from '../../lib/errors';
import { bandFor, BandRows } from '../../lib/scoring/band';
import { scoreQuestions, SCORING_VERSION, type ScorableQuestion } from '../../lib/scoring/score';
import type {
  AttemptResultDto,
  AttemptStateDto,
  AttemptSummaryDto,
  AutosaveBody,
  StartAttemptBody,
  SubmitBody,
} from '../../shared/attempt';
import type { BandTableKind, QuestionType, Role, SubmitReason } from '../../shared/enums';
import {
  AnswerValue,
  CorrectAnswer,
  QuestionGroupConfig,
  allowedKeys,
  expectedValueKind,
} from '../../shared/question-types';
import { bandTablesService } from '../band-tables/band-tables.service';
import { writingService } from '../writing/writing.service';
import {
  filterToScope,
  loadSection,
  loadSectionBySkill,
  scopedQuestionIds,
  toContentDto,
  type Scope,
} from './attempt-content.service';

export interface Actor {
  id: string;
  role: Role;
}

type AttemptRow = Prisma.AttemptGetPayload<{
  include: {
    test: { select: { title: true; source: true; type: true } };
    section: { select: { skill: true } };
  };
}>;

const attemptInclude = {
  test: { select: { title: true, source: true, type: true } },
  section: { select: { skill: true } },
} as const;

const TYPE_LABEL: Partial<Record<QuestionType, string>> = {
  TRUE_FALSE_NOT_GIVEN: 'True/False/Not Given',
  YES_NO_NOT_GIVEN: 'Yes/No/Not Given',
  MATCHING_HEADINGS: 'Matching headings',
  MULTIPLE_CHOICE_SINGLE: 'Multiple choice',
  MULTIPLE_CHOICE_MULTI: 'Multiple choice (nhiều đáp án)',
  SENTENCE_COMPLETION: 'Sentence completion',
  SUMMARY_COMPLETION: 'Summary completion',
  NOTE_TABLE_FLOWCHART_COMPLETION: 'Note/Table/Flow-chart',
  SHORT_ANSWER: 'Short answer',
  MAP_DIAGRAM_LABELLING: 'Map/Diagram',
  MATCHING_INFORMATION: 'Matching information',
  MATCHING_FEATURES: 'Matching features',
};

function scopeKeyOf(b: {
  scope: string;
  partId?: string | null;
  questionTypes?: string[];
  questionNumbers?: number[];
}) {
  switch (b.scope) {
    case 'PART':
      return `PART:${b.partId ?? ''}`;
    case 'QUESTION_TYPE':
      return `QT:${[...(b.questionTypes ?? [])].sort().join(',')}`;
    case 'QUESTION_IDS':
      return `QN:${[...(b.questionNumbers ?? [])].sort((x, y) => x - y).join(',')}`;
    default:
      return 'SECTION';
  }
}

function scopeLabel(
  a: { scope: string; questionTypes: QuestionType[]; questionNumbers: number[] },
  partNumber?: number,
) {
  if (a.scope === 'PART') return `Part ${partNumber ?? ''}`.trim();
  if (a.scope === 'QUESTION_TYPE')
    return `Dạng: ${a.questionTypes.map((t) => TYPE_LABEL[t] ?? t).join(', ')}`;
  if (a.scope === 'QUESTION_IDS') return `Làm lại ${a.questionNumbers.length} câu sai`;
  return 'Cả bài';
}

const scopeOf = (a: {
  scope: Scope['scope'];
  partId: string | null;
  questionTypes: QuestionType[];
  questionNumbers: number[];
}): Scope => ({
  scope: a.scope,
  partId: a.partId,
  questionTypes: a.questionTypes,
  questionNumbers: a.questionNumbers,
});

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function createAttemptsService(clock: Clock = systemClock) {
  const graceMs = () => env.ATTEMPT_GRACE_SECONDS * 1000;

  async function load(id: string, actor: Actor, opts: { write?: boolean } = {}): Promise<AttemptRow> {
    const a = await prisma.attempt.findUnique({ where: { id }, include: attemptInclude });
    // Someone else's attempt → 404 (do not reveal it exists). Admins can read, never write.
    if (!a || (a.userId !== actor.id && (opts.write || actor.role !== 'ADMIN'))) throw notFound('Bài làm');
    return a;
  }

  async function summary(a: AttemptRow): Promise<AttemptSummaryDto> {
    const [answered, part] = await Promise.all([
      // Flag-only rows have value NULL: count only answered questions.
      prisma.answer.count({ where: { attemptId: a.id, value: { not: Prisma.DbNull } } }),
      a.partId ? prisma.part.findUnique({ where: { id: a.partId }, select: { number: true } }) : null,
    ]);
    return {
      id: a.id,
      testId: a.testId,
      testTitle: a.test.title,
      source: a.test.source,
      skill: a.section.skill,
      mode: a.mode,
      scope: a.scope,
      scopeLabel: scopeLabel(a, part?.number),
      status: a.status,
      isPreview: a.isPreview,
      startedAt: iso(a.startedAt),
      deadlineAt: iso(a.deadlineAt),
      submittedAt: iso(a.submittedAt),
      rawScore: a.rawScore,
      maxScore: a.maxScore,
      band: a.band,
      answeredCount: answered,
      createdAt: a.createdAt.toISOString(),
    };
  }

  function isOverdue(a: { status: string; deadlineAt: Date | null }, now = clock.now()) {
    return (
      a.status === 'IN_PROGRESS' &&
      a.deadlineAt !== null &&
      now.getTime() > a.deadlineAt.getTime() + graceMs()
    );
  }

  /** Listening EXAM: where the (single-play) recording should be now, from the server clock. */
  async function listeningPosition(a: AttemptRow) {
    if (a.section.skill !== 'LISTENING' || a.mode !== 'EXAM' || !a.startedAt || a.status !== 'IN_PROGRESS')
      return null;
    const section = await loadSection(a.sectionId);
    const parts = filterToScope(section, scopeOf(a));
    let elapsed = clock.now().getTime() - a.startedAt.getTime();
    for (const p of parts) {
      const len = p.audio ? (p.audio.endMs ?? p.audio.durationMs) - (p.audio.startMs ?? 0) : 0;
      if (elapsed < len)
        return { phase: 'AUDIO' as const, partNumber: p.number, offsetMs: Math.max(0, elapsed) };
      elapsed -= len;
    }
    return {
      phase: a.deadlineAt && clock.now() > a.deadlineAt ? ('DONE' as const) : ('REVIEW' as const),
      partNumber: null,
      offsetMs: 0,
    };
  }

  async function toState(a: AttemptRow): Promise<AttemptStateDto> {
    const [answers, parts, sum, listening] = await Promise.all([
      prisma.answer.findMany({
        where: { attemptId: a.id },
        select: { questionId: true, value: true, flagged: true },
      }),
      prisma.attemptPart.findMany({
        where: { attemptId: a.id },
        select: { partId: true, timeSpentMs: true },
      }),
      summary(a),
      listeningPosition(a),
    ]);
    const answerMap: Record<string, AnswerValue> = {};
    for (const row of answers) {
      const v = AnswerValue.safeParse(row.value);
      if (v.success) answerMap[row.questionId] = v.data;
    }
    const settings =
      typeof a.settings === 'object' && a.settings !== null ? (a.settings as { blockPaste?: boolean }) : {};
    return {
      ...sum,
      serverNow: clock.now().toISOString(),
      graceSec: env.ATTEMPT_GRACE_SECONDS,
      lastClientSeq: a.lastClientSeq,
      currentQuestionNumber: a.currentQuestionNumber,
      answers: answerMap,
      flagged: answers.filter((r) => r.flagged).map((r) => r.questionId),
      timeByPart: Object.fromEntries(parts.map((p) => [p.partId, p.timeSpentMs])),
      uiState:
        typeof a.uiState === 'object' && a.uiState !== null ? (a.uiState as Record<string, unknown>) : {},
      settings: { blockPaste: settings.blockPaste === true },
      listening,
    };
  }

  /** Validate answer kinds/keys against each question's group; returns canonicalised values. */
  async function validateAnswers(attempt: AttemptRow, answers: Record<string, AnswerValue | null>) {
    const parts = filterToScope(await loadSection(attempt.sectionId), scopeOf(attempt));
    const byId = new Map(
      parts.flatMap((p) => p.groups.flatMap((g) => g.questions.map((q) => [q.id, { g, q }] as const))),
    );
    const out = new Map<string, AnswerValue | null>();
    for (const [qid, value] of Object.entries(answers)) {
      const hit = byId.get(qid);
      if (!hit)
        throw new AppError('VALIDATION_ERROR', 'Câu hỏi không thuộc bài làm này', { questionId: qid });
      if (value === null) {
        out.set(qid, null);
        continue;
      }
      const config = QuestionGroupConfig.parse(hit.g.config);
      const kind = expectedValueKind(config);
      if (value.kind !== kind) throw new AppError('VALIDATION_ERROR', `Câu ${hit.q.number}: sai kiểu đáp án`);
      if (value.kind === 'KEY') {
        const keys = allowedKeys(config, hit.q.content) ?? [];
        const canon = keys.find(
          (k) => k.toUpperCase() === value.key.trim().toUpperCase().replace(/\s+/g, '_'),
        );
        if (!canon) throw new AppError('VALIDATION_ERROR', `Câu ${hit.q.number}: lựa chọn không hợp lệ`);
        out.set(qid, { kind: 'KEY', key: canon });
      } else {
        out.set(qid, value);
      }
    }
    return { values: out, partIds: new Set(parts.map((p) => p.id)) };
  }

  async function bandTableFor(
    attempt: { testId: string },
    skill: string,
  ): Promise<{ id: string; rows: BandRows } | null> {
    if (skill !== 'READING' && skill !== 'LISTENING') return null;
    const test = await prisma.test.findUniqueOrThrow({
      where: { id: attempt.testId },
      select: { type: true, bandTableId: true },
    });
    const kind: BandTableKind =
      skill === 'LISTENING' ? 'LISTENING' : test.type === 'GENERAL' ? 'READING_GENERAL' : 'READING_ACADEMIC';
    if (test.bandTableId) {
      const t = await bandTablesService.byId(test.bandTableId);
      if (t.kind === kind) return { id: t.id, rows: BandRows.parse(t.rows) };
    }
    const t = await bandTablesService.active(kind);
    return { id: t.id, rows: BandRows.parse(t.rows) };
  }

  /** Submit exactly once (compare-and-set on status), then score. Safe when submit and the sweeper race. */
  async function finalize(id: string, reason: SubmitReason): Promise<boolean> {
    const now = clock.now();
    const claimed = await prisma.attempt.updateMany({
      where: { id, status: 'IN_PROGRESS' },
      data: {
        status: reason === 'DEADLINE' ? 'EXPIRED' : 'SUBMITTED',
        submittedAt: now,
        submitReason: reason,
        activeScopeKey: null,
      },
    });
    if (claimed.count === 0) return false;

    const a = await prisma.attempt.findUniqueOrThrow({ where: { id }, include: attemptInclude });
    const parts = filterToScope(await loadSection(a.sectionId), scopeOf(a));
    const ids = scopedQuestionIds(parts);
    if (ids.length === 0) {
      // Writing / Speaking: nothing to auto-score; Writing locks the texts and queues the estimate.
      await prisma.attempt.update({
        where: { id },
        data: { scoredAt: now, scoringVersion: SCORING_VERSION },
      });
      if (a.section.skill === 'WRITING') await writingService.onAttemptFinalized(id, now);
      await onFinalized?.(a.userId, now);
      return true;
    }
    const keys = await prisma.question.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        number: true,
        groupId: true,
        correctAnswer: true,
        acceptedAnswers: true,
        wordLimit: true,
      },
    });
    const keyById = new Map(keys.map((k) => [k.id, k]));
    const scorable: ScorableQuestion[] = parts.flatMap((p) =>
      p.groups.flatMap((g) => {
        const config = QuestionGroupConfig.parse(g.config);
        const allowNumber = 'wordLimit' in config && config.wordLimit ? config.wordLimit.allowNumber : false;
        return g.questions.map((q) => {
          const k = keyById.get(q.id);
          return {
            id: q.id,
            number: q.number,
            groupId: g.id,
            type: g.type,
            correctAnswer: CorrectAnswer.parse(k?.correctAnswer),
            acceptedAnswers: k?.acceptedAnswers ?? [],
            wordLimit: k?.wordLimit ?? null,
            allowNumber,
          };
        });
      }),
    );
    const rows = await prisma.answer.findMany({
      where: { attemptId: id },
      select: { id: true, questionId: true, value: true },
    });
    const answerMap = new Map(
      rows.map((r) => [r.questionId, AnswerValue.nullable().catch(null).parse(r.value)]),
    );
    const results = scoreQuestions(scorable, answerMap);
    const raw = results.filter((r) => r.isCorrect).length;
    const table = a.scope === 'SECTION' ? await bandTableFor(a, a.section.skill) : null;
    const partOf = new Map(
      parts.flatMap((p) => p.groups.flatMap((g) => g.questions.map((q) => [q.id, p.id] as const))),
    );

    await prisma.$transaction(async (tx) => {
      for (const r of results) {
        const row = rows.find((x) => x.questionId === r.questionId);
        if (row)
          await tx.answer.update({
            where: { id: row.id },
            data: { isCorrect: r.isCorrect, scoringNotes: r.notes },
          });
      }
      for (const p of parts) {
        const mine = results.filter((r) => partOf.get(r.questionId) === p.id);
        await tx.attemptPart.upsert({
          where: { attemptId_partId: { attemptId: id, partId: p.id } },
          create: {
            attemptId: id,
            partId: p.id,
            rawScore: mine.filter((r) => r.isCorrect).length,
            maxScore: mine.length,
          },
          update: { rawScore: mine.filter((r) => r.isCorrect).length, maxScore: mine.length },
        });
      }
      await tx.attempt.update({
        where: { id },
        data: {
          rawScore: raw,
          maxScore: results.length,
          band: table && results.length === 40 ? bandFor(table.rows, raw) : null,
          bandTableId: table?.id ?? null,
          scoringVersion: SCORING_VERSION,
          scoredAt: now,
        },
      });
    });
    await onFinalized?.(a.userId, now);
    return true;
  }

  /** Hook for study statistics (Phase 6) — set by the stats module to avoid an import cycle. */
  let onFinalized: ((userId: string, at: Date) => Promise<void>) | undefined;

  async function finalizeIfOverdue(a: AttemptRow): Promise<AttemptRow> {
    if (!isOverdue(a)) return a;
    await finalize(a.id, 'DEADLINE');
    return prisma.attempt.findUniqueOrThrow({ where: { id: a.id }, include: attemptInclude });
  }

  return {
    setOnFinalized(fn: (userId: string, at: Date) => Promise<void>) {
      onFinalized = fn;
    },

    /** Create (CREATED) or resume the open attempt for the same scope (D6: one open attempt per scope). */
    async start(
      actor: Actor,
      body: StartAttemptBody,
    ): Promise<{ attempt: AttemptSummaryDto; resumed: boolean }> {
      const section = await loadSectionBySkill(body.testId, body.skill);
      const published = section.test.status === 'PUBLISHED';
      if (!published && actor.role !== 'ADMIN') throw notFound('Đề');
      if (body.scope === 'PART' && !section.parts.some((p) => p.id === body.partId)) {
        throw new AppError('VALIDATION_ERROR', 'Phần (part) không thuộc kỹ năng này');
      }
      const scope: Scope = {
        scope: body.scope,
        partId: body.partId ?? null,
        questionTypes: body.questionTypes ?? [],
        questionNumbers: body.questionNumbers ?? [],
      };
      filterToScope(section, scope); // throws when the scope has no questions (except writing/speaking parts)
      const scopeKey = `${body.mode}|${scopeKeyOf(body)}`;
      const open = await prisma.attempt.findFirst({
        where: { userId: actor.id, sectionId: section.id, activeScopeKey: scopeKey },
        include: attemptInclude,
      });
      if (open) {
        const fresh = await finalizeIfOverdue(open);
        if (fresh.status === 'CREATED' || fresh.status === 'IN_PROGRESS')
          return { attempt: await summary(fresh), resumed: true };
      }
      const a = await prisma.attempt.create({
        data: {
          userId: actor.id,
          testId: body.testId,
          sectionId: section.id,
          mode: body.mode,
          scope: body.scope,
          partId: body.partId ?? null,
          questionTypes: body.questionTypes ?? [],
          questionNumbers: body.questionNumbers ?? [],
          scopeKey,
          activeScopeKey: scopeKey,
          isPreview: !published,
          settings: { blockPaste: body.blockPaste === true },
        },
        include: attemptInclude,
      });
      return { attempt: await summary(a), resumed: false };
    },

    /** "Bắt đầu": the server clock starts now; EXAM gets a deadline. Idempotent. */
    async begin(actor: Actor, id: string): Promise<AttemptStateDto> {
      const a = await load(id, actor, { write: true });
      if (a.status !== 'CREATED') return toState(await finalizeIfOverdue(a));
      const section = await loadSection(a.sectionId);
      const parts = filterToScope(section, scopeOf(a));
      let limit: number | null = null;
      if (a.mode === 'EXAM') {
        if (a.scope === 'SECTION') limit = section.durationSec;
        else {
          const p = parts[0];
          const audioSec = p?.audio
            ? Math.ceil(((p.audio.endMs ?? p.audio.durationMs) - (p.audio.startMs ?? 0)) / 1000)
            : 0;
          limit = p?.durationSec ?? (audioSec ? audioSec + 30 : (p?.suggestedMinutes ?? 20) * 60);
        }
      }
      const now = clock.now();
      await prisma.attempt.updateMany({
        where: { id, status: 'CREATED' },
        data: {
          status: 'IN_PROGRESS',
          startedAt: now,
          timeLimitSec: limit,
          deadlineAt: limit === null ? null : new Date(now.getTime() + limit * 1000),
          lastSavedAt: now,
        },
      });
      return toState(await prisma.attempt.findUniqueOrThrow({ where: { id }, include: attemptInclude }));
    },

    async state(actor: Actor, id: string): Promise<AttemptStateDto> {
      return toState(await finalizeIfOverdue(await load(id, actor)));
    },

    async content(actor: Actor, id: string) {
      const a = await load(id, actor);
      const section = await loadSection(a.sectionId);
      return toContentDto(a.id, section, filterToScope(section, scopeOf(a)));
    },

    /** Full snapshot + clientSeq (stale or duplicate saves are ignored). */
    async autosave(actor: Actor, id: string, body: AutosaveBody) {
      let a = await load(id, actor, { write: true });
      a = await finalizeIfOverdue(a);
      if (a.status === 'SUBMITTED' || a.status === 'EXPIRED') {
        throw new AppError('ATTEMPT_DEADLINE_PASSED', 'Bài đã được nộp', { status: a.status });
      }
      if (a.status !== 'IN_PROGRESS') throw new AppError('CONFLICT', 'Bài chưa bắt đầu');
      const { values, partIds } = await validateAnswers(a, body.answers);
      const flagged = new Set(body.flagged);
      const now = clock.now();
      const applied = await prisma.$transaction(async (tx) => {
        const claim = await tx.attempt.updateMany({
          where: { id, status: 'IN_PROGRESS', lastClientSeq: { lt: body.clientSeq } },
          data: {
            lastClientSeq: body.clientSeq,
            lastSavedAt: now,
            ...(body.currentQuestionNumber !== undefined
              ? { currentQuestionNumber: body.currentQuestionNumber }
              : {}),
            ...(body.uiState ? { uiState: body.uiState as Prisma.InputJsonValue } : {}),
          },
        });
        if (claim.count === 0) return false;
        await tx.answer.deleteMany({ where: { attemptId: id } });
        const qids = new Set([...values.keys(), ...flagged]);
        const data = [...qids].flatMap((qid) => {
          const value = values.get(qid) ?? null;
          if (value === null && !flagged.has(qid)) return [];
          return [
            {
              attemptId: id,
              questionId: qid,
              value: value ?? undefined,
              flagged: flagged.has(qid),
              answeredAt: value ? now : null,
            },
          ];
        });
        if (data.length) await tx.answer.createMany({ data });
        if (body.timeByPart && a.startedAt) {
          const cap = now.getTime() - a.startedAt.getTime();
          for (const [partId, ms] of Object.entries(body.timeByPart)) {
            if (!partIds.has(partId)) continue;
            const value = Math.min(ms, cap);
            const existing = await tx.attemptPart.findUnique({
              where: { attemptId_partId: { attemptId: id, partId } },
            });
            await tx.attemptPart.upsert({
              where: { attemptId_partId: { attemptId: id, partId } },
              create: { attemptId: id, partId, timeSpentMs: value },
              update: { timeSpentMs: Math.max(existing?.timeSpentMs ?? 0, value) },
            });
          }
        }
        return true;
      });
      const fresh = await prisma.attempt.findUniqueOrThrow({
        where: { id },
        select: { lastClientSeq: true, deadlineAt: true },
      });
      return {
        applied,
        savedSeq: fresh.lastClientSeq,
        serverNow: now.toISOString(),
        deadlineAt: iso(fresh.deadlineAt),
      };
    },

    /** Saves the final snapshot (if inside the deadline + grace) then finalizes. Idempotent. */
    async submit(actor: Actor, id: string, body: SubmitBody) {
      let a = await load(id, actor, { write: true });
      if (a.status === 'CREATED') throw new AppError('CONFLICT', 'Bài chưa bắt đầu');
      let lateAnswersIgnored = false;
      if (a.status === 'IN_PROGRESS' && body.answers && body.clientSeq !== undefined) {
        if (isOverdue(a)) lateAnswersIgnored = true;
        else
          await this.autosave(actor, id, {
            clientSeq: body.clientSeq,
            answers: body.answers,
            flagged: body.flagged,
            currentQuestionNumber: body.currentQuestionNumber,
            timeByPart: body.timeByPart,
          });
      }
      a = await prisma.attempt.findUniqueOrThrow({ where: { id }, include: attemptInclude });
      if (a.status === 'IN_PROGRESS') await finalize(id, isOverdue(a) ? 'DEADLINE' : 'USER');
      const done = await prisma.attempt.findUniqueOrThrow({ where: { id }, include: attemptInclude });
      return { attempt: await summary(done), lateAnswersIgnored };
    },

    /** Drop an unfinished PRACTICE attempt (EXAM attempts cannot be abandoned — they are submitted by the clock). */
    async abandon(actor: Actor, id: string): Promise<void> {
      const a = await load(id, actor, { write: true });
      if (a.mode !== 'PRACTICE' && a.status !== 'CREATED') {
        throw new AppError('CONFLICT', 'Bài thi (EXAM) đã bắt đầu thì không hủy được');
      }
      if (a.status !== 'CREATED' && a.status !== 'IN_PROGRESS') throw new AppError('CONFLICT', 'Bài đã nộp');
      await prisma.attempt.update({ where: { id }, data: { status: 'ABANDONED', activeScopeKey: null } });
    },

    async list(actor: Actor, q: { status?: string; skill?: string; page: number; pageSize: number }) {
      const where: Prisma.AttemptWhereInput = {
        userId: actor.id,
        ...(q.status
          ? { status: q.status as Prisma.AttemptWhereInput['status'] }
          : { status: { not: 'ABANDONED' } }),
        ...(q.skill ? { section: { skill: q.skill as 'READING' } } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.attempt.findMany({
          where,
          include: attemptInclude,
          orderBy: { createdAt: 'desc' },
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
        }),
        prisma.attempt.count({ where }),
      ]);
      return { items: await Promise.all(rows.map(summary)), page: q.page, pageSize: q.pageSize, total };
    },

    async result(actor: Actor, id: string): Promise<AttemptResultDto> {
      const a = await finalizeIfOverdue(await load(id, actor));
      if (a.status !== 'SUBMITTED' && a.status !== 'EXPIRED') {
        throw new AppError('ATTEMPT_NOT_SUBMITTED', 'Bài chưa nộp — chưa xem được kết quả');
      }
      const section = await loadSection(a.sectionId);
      const parts = filterToScope(section, scopeOf(a));
      const ids = scopedQuestionIds(parts);
      const [keys, answers, attemptParts, user, previous, table] = await Promise.all([
        prisma.question.findMany({
          where: { id: { in: ids } },
          select: { id: true, correctAnswer: true, acceptedAnswers: true, explanation: true, evidence: true },
        }),
        prisma.answer.findMany({ where: { attemptId: id } }),
        prisma.attemptPart.findMany({ where: { attemptId: id } }),
        prisma.user.findUnique({ where: { id: a.userId }, select: { targetBand: true } }),
        prisma.attempt.findFirst({
          where: {
            userId: a.userId,
            sectionId: { not: undefined },
            section: { skill: a.section.skill },
            scope: 'SECTION',
            band: { not: null },
            submittedAt: { lt: a.submittedAt ?? new Date() },
            id: { not: a.id },
          },
          orderBy: { submittedAt: 'desc' },
          select: { band: true },
        }),
        a.bandTableId ? prisma.bandTable.findUnique({ where: { id: a.bandTableId } }) : null,
      ]);
      const keyById = new Map(keys.map((k) => [k.id, k]));
      const ansById = new Map(answers.map((x) => [x.questionId, x]));
      const items = parts.flatMap((p) =>
        p.groups.flatMap((g) =>
          g.questions.map((q) => {
            const k = keyById.get(q.id);
            const correct = CorrectAnswer.parse(k?.correctAnswer);
            const ans = ansById.get(q.id);
            const v = AnswerValue.nullable()
              .catch(null)
              .parse(ans?.value ?? null);
            const notes = (ans?.scoringNotes ?? {}) as { wordLimitExceeded?: boolean };
            const ev = k?.evidence as {
              paragraphId: string;
              start: number;
              end: number;
              exact: string;
            } | null;
            return {
              questionId: q.id,
              number: q.number,
              partNumber: p.number,
              type: g.type,
              prompt: q.prompt,
              yours: v ? (v.kind === 'KEY' ? v.key : v.text) : null,
              correct:
                correct.kind === 'TEXT'
                  ? correct.display
                  : correct.kind === 'KEY'
                    ? correct.key
                    : correct.keys.join(', '),
              accepted: k?.acceptedAnswers ?? [],
              isCorrect: ans?.isCorrect === true,
              blank: !v,
              wordLimitExceeded: notes.wordLimitExceeded === true,
              explanation: k?.explanation ?? null,
              evidence: ev ?? null,
            };
          }),
        ),
      );
      const byTypeMap = new Map<QuestionType, { correct: number; total: number }>();
      for (const it of items) {
        const t = byTypeMap.get(it.type) ?? { correct: 0, total: 0 };
        t.total += 1;
        if (it.isCorrect) t.correct += 1;
        byTypeMap.set(it.type, t);
      }
      const byPart = parts.map((p) => {
        const mine = items.filter((i) => i.partNumber === p.number);
        return {
          partNumber: p.number,
          correct: mine.filter((i) => i.isCorrect).length,
          total: mine.length,
          timeSpentMs: attemptParts.find((x) => x.partId === p.id)?.timeSpentMs ?? 0,
          suggestedMinutes: p.suggestedMinutes,
        };
      });
      return {
        attempt: await summary(a),
        bandTable: table
          ? { kind: table.kind, version: table.version, isReference: table.isReference }
          : null,
        previousBand: previous?.band ?? null,
        targetBand: user?.targetBand ?? null,
        items,
        byType: [...byTypeMap.entries()].map(([type, v]) => ({ type, ...v })),
        byPart,
        timeSpentMs:
          a.startedAt && a.submittedAt
            ? Math.min(
                a.submittedAt.getTime() - a.startedAt.getTime(),
                (a.timeLimitSec ?? Infinity) * 1000 + graceMs(),
              )
            : 0,
      };
    },

    /** "Làm lại câu sai": a PRACTICE attempt over the wrong/blank questions of a submitted attempt. */
    async retryWrong(actor: Actor, id: string) {
      const a = await load(id, actor, { write: true });
      if (a.status !== 'SUBMITTED' && a.status !== 'EXPIRED')
        throw new AppError('ATTEMPT_NOT_SUBMITTED', 'Bài chưa nộp');
      const result = await this.result(actor, id);
      const wrong = result.items.filter((i) => !i.isCorrect).map((i) => i.number);
      if (!wrong.length) throw new AppError('CONFLICT', 'Không có câu sai nào để làm lại');
      const created = await this.start(actor, {
        testId: a.testId,
        skill: a.section.skill,
        mode: 'PRACTICE',
        scope: 'QUESTION_IDS',
        questionNumbers: wrong,
      });
      await prisma.attempt.update({ where: { id: created.attempt.id }, data: { sourceAttemptId: id } });
      return created;
    },

    /** Sweeper: auto-submit attempts past deadline + grace (also done lazily on every read/write). */
    async finalizeExpired(): Promise<boolean> {
      const cutoff = new Date(clock.now().getTime() - graceMs());
      const due = await prisma.attempt.findMany({
        where: { status: 'IN_PROGRESS', deadlineAt: { lt: cutoff } },
        select: { id: true },
        take: 20,
      });
      for (const { id } of due) {
        try {
          await finalize(id, 'DEADLINE');
        } catch (err) {
          logger.error({ err, attemptId: id }, 'auto-submit failed');
        }
      }
      return due.length === 20;
    },

    finalize,
  };
}

export type AttemptsService = ReturnType<typeof createAttemptsService>;
export const attemptsService = createAttemptsService();
