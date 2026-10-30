// GENERATED from backend/src/shared by scripts/sync-shared.mjs — DO NOT EDIT.
// Phase 6 contracts: vocabulary + SM-2 flashcards, dictionary lookup, study statistics / dashboard, test marks.
import { z } from 'zod';
import { AttemptSummaryDto } from './attempt';
import { QuestionType, Skill, TestSource, VocabState } from './enums';
import { Band, Uuid } from './primitives';

// ───── App defaults (proposed values, editable in code — plan §9.4) ─────
export const STUDY_DEFAULTS = {
  /** A day counts toward the streak with ≥ 10 active minutes, or a submitted attempt, or ≥ 10 card reviews. */
  streakMinSeconds: 600,
  streakMinReviews: 10,
  /** Heatmap levels in minutes: 0 / 1–19 / 20–44 / ≥ 45. */
  heatmapLevels: [1, 20, 45] as const,
  /** "Weak question type": accuracy below 65 % over at least 5 questions. */
  weakTypeAccuracy: 0.65,
  weakTypeMinQuestions: 5,
} as const;

// ───── SM-2 + learning steps ─────
export const ReviewGrade = z.enum(['AGAIN', 'HARD', 'GOOD', 'EASY']);
export type ReviewGrade = z.infer<typeof ReviewGrade>;
/** SM-2 quality per button (C-Flashcard: Lại / Khó / Được / Dễ). */
export const GRADE_QUALITY: Record<ReviewGrade, number> = { AGAIN: 1, HARD: 3, GOOD: 4, EASY: 5 };

export interface SrsCard {
  state: VocabState;
  learningStep: number;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}
export interface SrsResult extends SrsCard {
  dueAt: Date;
}

const MIN = 60_000;
const DAY = 86_400_000;
const LEARN_AGAIN_MS = 1 * MIN;
const LEARN_HARD_MS = 6 * MIN;
const GRADUATE_GOOD_DAYS = 1;
const GRADUATE_EASY_DAYS = 4;

export function nextEase(ef: number, q: number): number {
  const v = ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  return Math.max(1.3, Math.round(v * 1000) / 1000);
}

/** Pure scheduler: card + grade + now → next card state and due time. */
export function schedule(card: SrsCard, grade: ReviewGrade, now: Date): SrsResult {
  const q = GRADE_QUALITY[grade];
  const t = now.getTime();
  if (card.state === 'NEW' || card.state === 'LEARNING') {
    if (grade === 'AGAIN')
      return { ...card, state: 'LEARNING', learningStep: 0, dueAt: new Date(t + LEARN_AGAIN_MS) };
    if (grade === 'HARD')
      return { ...card, state: 'LEARNING', learningStep: 1, dueAt: new Date(t + LEARN_HARD_MS) };
    const days = grade === 'EASY' ? GRADUATE_EASY_DAYS : GRADUATE_GOOD_DAYS;
    return {
      ...card,
      state: 'REVIEW',
      learningStep: 0,
      intervalDays: days,
      repetitions: card.repetitions + 1,
      easeFactor: grade === 'EASY' ? nextEase(card.easeFactor, q) : card.easeFactor,
      dueAt: new Date(t + days * DAY),
    };
  }
  if (card.state === 'RELEARNING') {
    if (grade === 'AGAIN') return { ...card, learningStep: 0, dueAt: new Date(t + LEARN_AGAIN_MS) };
    if (grade === 'HARD') return { ...card, learningStep: 1, dueAt: new Date(t + LEARN_HARD_MS) };
    const days = Math.max(1, card.intervalDays) + (grade === 'EASY' ? 1 : 0);
    return { ...card, state: 'REVIEW', learningStep: 0, intervalDays: days, dueAt: new Date(t + days * DAY) };
  }
  // REVIEW
  const ef = nextEase(card.easeFactor, q);
  if (grade === 'AGAIN') {
    return {
      ...card,
      state: 'RELEARNING',
      learningStep: 0,
      lapses: card.lapses + 1,
      repetitions: 0,
      intervalDays: 1,
      easeFactor: ef,
      dueAt: new Date(t + LEARN_AGAIN_MS),
    };
  }
  const i = Math.max(1, card.intervalDays);
  const hard = Math.max(i + 1, Math.round(i * 1.2));
  const good = Math.max(hard + 1, Math.round(i * ef));
  const easy = Math.max(good + 1, Math.round(i * ef * 1.3));
  const days = grade === 'HARD' ? hard : grade === 'GOOD' ? good : easy;
  return {
    ...card,
    state: 'REVIEW',
    intervalDays: days,
    repetitions: card.repetitions + 1,
    easeFactor: ef,
    dueAt: new Date(t + days * DAY),
  };
}

/** Human label of the gap until the next review ("<1 phút", "6 phút", "1 ngày", "3 tháng"). */
export function gapLabel(ms: number): string {
  if (ms < 1.5 * MIN) return '<1 phút';
  if (ms < 60 * MIN) return `${Math.round(ms / MIN)} phút`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))} giờ`;
  const d = Math.round(ms / DAY);
  if (d < 31) return `${d} ngày`;
  if (d < 365) return `${Math.round(d / 30)} tháng`;
  return `${Math.round((d / 365) * 10) / 10} năm`;
}

export function preview(card: SrsCard, now: Date): Record<ReviewGrade, string> {
  const out = {} as Record<ReviewGrade, string>;
  for (const g of ReviewGrade.options)
    out[g] = gapLabel(schedule(card, g, now).dueAt.getTime() - now.getTime());
  return out;
}

export function normalizeTerm(term: string): string {
  return term.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

// ───── Vocabulary ─────
export const VocabularyDto = z.object({
  id: Uuid,
  term: z.string(),
  partOfSpeech: z.string().nullable(),
  phonetic: z.string().nullable(),
  meaning: z.string().nullable(),
  definition: z.string().nullable(),
  notes: z.string().nullable(),
  exampleSentence: z.string().nullable(),
  tags: z.array(z.string()),
  sourceTestTitle: z.string().nullable(),
  state: VocabState,
  intervalDays: z.number(),
  dueAt: z.iso.datetime(),
  lapses: z.number(),
  isSuspended: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type VocabularyDto = z.infer<typeof VocabularyDto>;

const VocabFields = {
  partOfSpeech: z.string().trim().max(40).nullable().optional(),
  phonetic: z.string().trim().max(80).nullable().optional(),
  meaning: z.string().trim().max(500).nullable().optional(),
  definition: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  exampleSentence: z.string().trim().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
};

export const CreateVocabularyBody = z.strictObject({
  term: z.string().trim().min(1).max(80),
  ...VocabFields,
  /** Saving from a passage (PRACTICE or the review screen): keeps the source sentence. */
  source: z
    .strictObject({
      attemptId: Uuid,
      paragraphId: Uuid,
      start: z.number().int().min(0),
      end: z.number().int().min(1),
    })
    .optional(),
});
export type CreateVocabularyBody = z.infer<typeof CreateVocabularyBody>;

export const UpdateVocabularyBody = z.strictObject({ ...VocabFields, isSuspended: z.boolean().optional() });
export type UpdateVocabularyBody = z.infer<typeof UpdateVocabularyBody>;

export const ListVocabularyQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(80).optional(),
  state: VocabState.optional(),
  tag: z.string().trim().max(40).optional(),
  due: z.enum(['true', 'false']).optional(),
});

export const ReviewCardDto = VocabularyDto.extend({
  preview: z.record(ReviewGrade, z.string()),
});
export type ReviewCardDto = z.infer<typeof ReviewCardDto>;

export const ReviewQueueDto = z.object({
  cards: z.array(ReviewCardDto),
  progress: z.object({ reviewedToday: z.number(), dailyLimit: z.number(), dueTotal: z.number() }),
});
export type ReviewQueueDto = z.infer<typeof ReviewQueueDto>;

export const ReviewBody = z.strictObject({ grade: ReviewGrade, clientReviewId: Uuid });

// ───── Dictionary ─────
export const DictionaryEntryDto = z.object({
  term: z.string(),
  phonetic: z.string().nullable(),
  audioUrl: z.string().nullable(),
  meanings: z.array(
    z.object({
      partOfSpeech: z.string(),
      definitions: z.array(z.object({ definition: z.string(), example: z.string().nullable() })),
      synonyms: z.array(z.string()),
    }),
  ),
  sourceUrl: z.string().nullable(),
  license: z.string().nullable(),
  cached: z.boolean(),
});
export type DictionaryEntryDto = z.infer<typeof DictionaryEntryDto>;
export const DictionaryQuery = z.object({ term: z.string().trim().min(1).max(60) });

// ───── Stats / dashboard ─────
export const SkillBand = z.object({
  skill: Skill,
  band: Band.nullable(),
  attempts: z.number(),
  lastAt: z.iso.datetime().nullable(),
});
export type SkillBand = z.infer<typeof SkillBand>;

export const DashboardDto = z.object({
  displayName: z.string(),
  targetBand: Band.nullable(),
  examDate: z.iso.date().nullable(),
  daysLeft: z.number().nullable(),
  continueAttempt: AttemptSummaryDto.nullable(),
  bandBySkill: z.array(SkillBand),
  overallBand: Band.nullable(),
  weakTypes: z.array(z.object({ type: QuestionType, correct: z.number(), total: z.number() })),
  streak: z.object({ current: z.number(), best: z.number(), todayMinutes: z.number() }),
  cards: z.object({ due: z.number(), total: z.number() }),
  suggestions: z.array(
    z.object({ testId: Uuid, title: z.string(), source: TestSource, skills: z.array(Skill) }),
  ),
});
export type DashboardDto = z.infer<typeof DashboardDto>;

export const BandTrendQuery = z.object({
  skill: z.enum(['OVERALL', 'LISTENING', 'READING', 'WRITING', 'SPEAKING']).default('OVERALL'),
  range: z.enum(['4w', '8w', 'all']).default('8w'),
});
export const BandTrendDto = z.object({
  skill: z.string(),
  points: z.array(z.object({ date: z.iso.date(), band: Band })),
});
export type BandTrendDto = z.infer<typeof BandTrendDto>;

export const HeatmapQuery = z.object({ days: z.coerce.number().int().min(7).max(366).default(182) });
export const HeatmapDto = z.object({
  days: z.array(z.object({ date: z.iso.date(), minutes: z.number(), level: z.number().int().min(0).max(3) })),
});
export type HeatmapDto = z.infer<typeof HeatmapDto>;

export const RadarDto = z.object({ skills: z.array(SkillBand) });
export type RadarDto = z.infer<typeof RadarDto>;

export const TestMarkParams = z.strictObject({ seriesKey: z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/) });
export const TestMarkBody = z.strictObject({ done: z.boolean().optional(), hidden: z.boolean().optional() });
