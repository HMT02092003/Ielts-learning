// Vocabulary notebook + SM-2 flashcards (spec §6 P6, C-Flashcard). Words saved from a passage keep the source
// sentence; that is allowed in PRACTICE and on the review screen only (never during an EXAM attempt).
import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { AppError, notFound } from '../../lib/errors';
import { dayRange, localDate } from '../../lib/tz';
import type { UserPreferences } from '../../shared/auth';
import {
  normalizeTerm,
  preview,
  schedule,
  GRADE_QUALITY,
  type CreateVocabularyBody,
  type ReviewGrade,
  type ReviewQueueDto,
  type UpdateVocabularyBody,
  type VocabularyDto,
} from '../../shared/study';
import { statsService } from '../stats/stats.service';

const include = { sourceTest: { select: { title: true } } } satisfies Prisma.VocabularyInclude;
type Row = Prisma.VocabularyGetPayload<{ include: typeof include }>;

function toDto(v: Row): VocabularyDto {
  return {
    id: v.id,
    term: v.term,
    partOfSpeech: v.partOfSpeech,
    phonetic: v.phonetic,
    meaning: v.meaning,
    definition: v.definition,
    notes: v.notes,
    exampleSentence: v.exampleSentence,
    tags: v.tags,
    sourceTestTitle: v.sourceTest?.title ?? null,
    state: v.state,
    intervalDays: v.intervalDays,
    dueAt: v.dueAt.toISOString(),
    lapses: v.lapses,
    isSuspended: v.isSuspended,
    createdAt: v.createdAt.toISOString(),
  };
}

/** The sentence around [start, end) in a paragraph (used as the card's example). */
function sentenceAround(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const from = Math.max(before.lastIndexOf('. '), before.lastIndexOf('? '), before.lastIndexOf('! '));
  const after = text.slice(end).search(/[.?!](\s|$)/);
  return text.slice(from < 0 ? 0 : from + 2, after < 0 ? text.length : end + after + 1).trim();
}

async function own(id: string, userId: string) {
  const v = await prisma.vocabulary.findUnique({ where: { id }, include });
  if (!v || v.userId !== userId) throw notFound('Từ vựng');
  return v;
}

export const vocabularyService = {
  async list(
    userId: string,
    q: {
      page: number;
      pageSize: number;
      q?: string;
      state?: VocabularyDto['state'];
      tag?: string;
      due?: string;
    },
  ) {
    const where: Prisma.VocabularyWhereInput = {
      userId,
      ...(q.q ? { normalizedTerm: { contains: normalizeTerm(q.q) } } : {}),
      ...(q.state ? { state: q.state } : {}),
      ...(q.tag ? { tags: { has: q.tag } } : {}),
      ...(q.due === 'true' ? { dueAt: { lte: new Date() }, isSuspended: false } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.vocabulary.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.vocabulary.count({ where }),
    ]);
    return { items: rows.map(toDto), page: q.page, pageSize: q.pageSize, total };
  },

  async create(userId: string, body: CreateVocabularyBody) {
    const normalizedTerm = normalizeTerm(body.term);
    let source: Prisma.VocabularyUncheckedCreateInput | Record<string, never> = {};
    if (body.source) {
      const a = await prisma.attempt.findUnique({
        where: { id: body.source.attemptId },
        select: { userId: true, mode: true, status: true, testId: true },
      });
      if (!a || a.userId !== userId) throw notFound('Bài làm');
      if (a.mode === 'EXAM' && (a.status === 'CREATED' || a.status === 'IN_PROGRESS')) {
        throw new AppError('CONFLICT', 'Không lưu từ trong lúc đang thi — lưu ở màn xem lại sau khi nộp');
      }
      const p = await prisma.paragraph.findFirst({
        where: { id: body.source.paragraphId, passage: { part: { section: { testId: a.testId } } } },
        select: { text: true },
      });
      if (!p || body.source.end > p.text.length) throw notFound('Đoạn văn');
      source = {
        userId,
        term: body.term,
        normalizedTerm,
        sourceTestId: a.testId,
        sourceAttemptId: body.source.attemptId,
        sourceParagraphId: body.source.paragraphId,
        sourceStart: body.source.start,
        sourceEnd: body.source.end,
        exampleSentence: body.exampleSentence ?? sentenceAround(p.text, body.source.start, body.source.end),
      };
    }
    const existing = await prisma.vocabulary.findUnique({
      where: { userId_normalizedTerm: { userId, normalizedTerm } },
    });
    if (existing) throw new AppError('CONFLICT', `“${existing.term}” đã có trong sổ từ`, { id: existing.id });
    const { source: _src, ...fields } = body;
    const v = await prisma.vocabulary.create({
      data: { ...fields, ...source, userId, term: body.term.trim(), normalizedTerm, tags: body.tags ?? [] },
      include,
    });
    await statsService.onActivity(userId, v.createdAt);
    return toDto(v);
  },

  async update(userId: string, id: string, body: UpdateVocabularyBody) {
    await own(id, userId);
    return toDto(await prisma.vocabulary.update({ where: { id }, data: body, include }));
  },

  async remove(userId: string, id: string) {
    await own(id, userId);
    await prisma.vocabulary.delete({ where: { id } });
  },

  /** Due cards for today, respecting the daily limits in the user's preferences. */
  async queue(userId: string, limit: number): Promise<ReviewQueueDto> {
    const now = new Date();
    const { start, end } = dayRange(localDate(now));
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { preferences: true },
    });
    const prefs = (user.preferences ?? {}) as Partial<UserPreferences>;
    const dailyLimit = prefs.dailyCardLimit ?? 20;
    const newPerDay = prefs.newCardsPerDay ?? 10;
    const [reviewedToday, newToday, dueTotal] = await Promise.all([
      prisma.vocabularyReview.count({
        where: { vocabulary: { userId }, reviewedAt: { gte: start, lt: end } },
      }),
      // New cards introduced today = first review ever happened today.
      prisma.vocabulary.count({
        where: {
          userId,
          reviews: { some: { reviewedAt: { gte: start, lt: end } }, none: { reviewedAt: { lt: start } } },
        },
      }),
      prisma.vocabulary.count({ where: { userId, isSuspended: false, dueAt: { lte: now } } }),
    ]);
    const room = Math.max(0, Math.min(limit, dailyLimit - reviewedToday));
    const learning = await prisma.vocabulary.findMany({
      where: { userId, isSuspended: false, dueAt: { lte: now }, state: { not: 'NEW' } },
      include,
      orderBy: { dueAt: 'asc' },
      take: room,
    });
    const fresh = await prisma.vocabulary.findMany({
      where: { userId, isSuspended: false, dueAt: { lte: now }, state: 'NEW' },
      include,
      orderBy: { createdAt: 'asc' },
      take: Math.max(0, Math.min(room - learning.length, newPerDay - newToday)),
    });
    // Learning steps (< 1 day) are always shown even past the daily limit, so a session can finish.
    return {
      cards: [...learning, ...fresh].map((v) => ({ ...toDto(v), preview: preview(v, now) })),
      progress: { reviewedToday, dailyLimit, dueTotal },
    };
  },

  async review(userId: string, id: string, grade: ReviewGrade, clientReviewId: string) {
    const done = await prisma.vocabularyReview.findUnique({ where: { clientReviewId } });
    if (done) return toDto(await own(done.vocabularyId, userId));
    const v = await own(id, userId);
    const now = new Date();
    const next = schedule(v, grade, now);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.vocabularyReview.create({
        data: {
          vocabularyId: id,
          clientReviewId,
          grade: GRADE_QUALITY[grade],
          reviewedAt: now,
          prevIntervalDay: v.intervalDays,
          newIntervalDay: next.intervalDays,
          prevEaseFactor: v.easeFactor,
          newEaseFactor: next.easeFactor,
        },
      });
      return tx.vocabulary.update({
        where: { id },
        data: {
          state: next.state,
          learningStep: next.learningStep,
          easeFactor: next.easeFactor,
          intervalDays: next.intervalDays,
          repetitions: next.repetitions,
          lapses: next.lapses,
          dueAt: next.dueAt,
          lastReviewedAt: now,
        },
        include,
      });
    });
    await statsService.onActivity(userId, now);
    return toDto(updated);
  },
};
