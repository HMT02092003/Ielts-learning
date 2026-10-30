// Attempt (taking a test) contracts — Phases 3/4. Student-facing content NEVER contains answers, explanations,
// evidence or transcripts before the attempt is submitted (fail-closed: DTOs are parsed with these schemas).
import { z } from 'zod';
import {
  AttemptMode,
  AttemptScope,
  AttemptStatus,
  ParagraphKind,
  QuestionType,
  Skill,
  SubmitReason,
  TestSource,
  TestType,
  WritingTaskKind,
} from './enums';
import { AnswerValue } from './question-types';
import { Band, Uuid } from './primitives';

// ───── Test library (student) ─────
export const TestCardSection = z.object({
  id: Uuid,
  skill: Skill,
  durationSec: z.number(),
  questionCount: z.number(),
  parts: z.array(z.object({ id: Uuid, number: z.number(), title: z.string().nullable() })),
  questionTypes: z.array(QuestionType),
});
export const TestCardDto = z.object({
  id: Uuid,
  seriesKey: z.string(),
  title: z.string(),
  source: TestSource,
  type: TestType,
  bookNumber: z.number().nullable(),
  testNumber: z.number().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  sections: z.array(TestCardSection),
  /** Per skill: best band / last submitted attempt of the current user. */
  progress: z.array(
    z.object({
      skill: Skill,
      attempts: z.number(),
      bestBand: Band.nullable(),
      lastAttemptAt: z.iso.datetime().nullable(),
    }),
  ),
  done: z.boolean(),
});
export type TestCardDto = z.infer<typeof TestCardDto>;

export const ListTestsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  q: z.string().trim().max(100).optional(),
  source: TestSource.optional(),
  type: TestType.optional(),
  skill: Skill.optional(),
  done: z.enum(['true', 'false']).optional(),
});
export type ListTestsQuery = z.infer<typeof ListTestsQuery>;

// ───── Start / state ─────
export const StartAttemptBody = z
  .strictObject({
    testId: Uuid,
    skill: Skill,
    mode: AttemptMode,
    scope: AttemptScope.default('SECTION'),
    partId: Uuid.optional(),
    questionTypes: z.array(QuestionType).min(1).max(12).optional(),
    questionNumbers: z.array(z.number().int().min(1).max(40)).min(1).max(40).optional(),
    blockPaste: z.boolean().optional(),
  })
  .superRefine((b, ctx) => {
    if (b.scope === 'PART' && !b.partId)
      ctx.addIssue({ code: 'custom', path: ['partId'], message: 'Thiếu partId' });
    if (b.scope === 'QUESTION_TYPE' && !b.questionTypes?.length) {
      ctx.addIssue({ code: 'custom', path: ['questionTypes'], message: 'Chọn ít nhất một dạng câu hỏi' });
    }
    if (b.mode === 'EXAM' && (b.scope === 'QUESTION_TYPE' || b.scope === 'QUESTION_IDS')) {
      ctx.addIssue({
        code: 'custom',
        path: ['scope'],
        message: 'Chế độ thi chỉ làm cả kỹ năng hoặc từng phần',
      });
    }
  });
export type StartAttemptBody = z.infer<typeof StartAttemptBody>;

export const AttemptSummaryDto = z.object({
  id: Uuid,
  testId: Uuid,
  testTitle: z.string(),
  source: TestSource,
  skill: Skill,
  mode: AttemptMode,
  scope: AttemptScope,
  scopeLabel: z.string(),
  status: AttemptStatus,
  isPreview: z.boolean(),
  startedAt: z.iso.datetime().nullable(),
  deadlineAt: z.iso.datetime().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  rawScore: z.number().nullable(),
  maxScore: z.number().nullable(),
  band: Band.nullable(),
  answeredCount: z.number(),
  createdAt: z.iso.datetime(),
});
export type AttemptSummaryDto = z.infer<typeof AttemptSummaryDto>;

export const ListeningPosition = z.object({
  phase: z.enum(['AUDIO', 'REVIEW', 'DONE']),
  partNumber: z.number().nullable(),
  offsetMs: z.number(),
});

export const AttemptStateDto = AttemptSummaryDto.extend({
  serverNow: z.iso.datetime(),
  graceSec: z.number(),
  lastClientSeq: z.number(),
  currentQuestionNumber: z.number().nullable(),
  answers: z.record(z.string(), AnswerValue),
  flagged: z.array(Uuid),
  timeByPart: z.record(z.string(), z.number()),
  uiState: z.record(z.string(), z.unknown()),
  settings: z.object({ blockPaste: z.boolean().default(false) }),
  listening: ListeningPosition.nullable(),
});
export type AttemptStateDto = z.infer<typeof AttemptStateDto>;

// ───── Content (no answers) ─────
export const ContentQuestion = z.object({
  id: Uuid,
  number: z.number(),
  prompt: z.string().nullable(),
  content: z.record(z.string(), z.unknown()),
});
export type ContentQuestion = z.infer<typeof ContentQuestion>;

export const ContentGroup = z.object({
  id: Uuid,
  type: QuestionType,
  instructions: z.string(),
  questionFrom: z.number(),
  questionTo: z.number(),
  config: z.record(z.string(), z.unknown()),
  imageId: Uuid.nullable(),
  questions: z.array(ContentQuestion),
});
export type ContentGroup = z.infer<typeof ContentGroup>;

export const ContentParagraph = z.object({
  id: Uuid,
  label: z.string().nullable(),
  kind: ParagraphKind,
  text: z.string(),
  imageId: Uuid.nullable(),
});
export type ContentParagraph = z.infer<typeof ContentParagraph>;

export const ContentPart = z.object({
  id: Uuid,
  number: z.number(),
  title: z.string().nullable(),
  instructions: z.string().nullable(),
  suggestedMinutes: z.number().nullable(),
  passage: z
    .object({ title: z.string(), subtitle: z.string().nullable(), paragraphs: z.array(ContentParagraph) })
    .nullable(),
  audio: z
    .object({
      fileId: Uuid,
      durationMs: z.number(),
      startMs: z.number().nullable(),
      endMs: z.number().nullable(),
    })
    .nullable(),
  writingTask: z
    .object({ kind: WritingTaskKind, prompt: z.string(), imageId: Uuid.nullable(), minWords: z.number() })
    .nullable(),
  speakingPart: z
    .object({
      topic: z.string().nullable(),
      questions: z.array(z.string()),
      cueCard: z
        .object({ topic: z.string(), bullets: z.array(z.string()), closing: z.string().optional() })
        .nullable(),
      prepSeconds: z.number(),
      speakSeconds: z.number().nullable(),
    })
    .nullable(),
  groups: z.array(ContentGroup),
});
export type ContentPart = z.infer<typeof ContentPart>;

export const AttemptContentDto = z.object({
  attemptId: Uuid,
  test: z.object({ id: Uuid, title: z.string(), source: TestSource, type: TestType }),
  skill: Skill,
  parts: z.array(ContentPart),
});
export type AttemptContentDto = z.infer<typeof AttemptContentDto>;

// ───── Saving ─────
export const AutosaveBody = z.strictObject({
  clientSeq: z.number().int().min(1),
  answers: z.record(Uuid, AnswerValue.nullable()),
  flagged: z.array(Uuid).max(80).default([]),
  currentQuestionNumber: z.number().int().min(1).max(40).nullable().optional(),
  /** Milliseconds spent per part (client-measured, capped server-side). */
  timeByPart: z.record(Uuid, z.number().int().min(0)).optional(),
  uiState: z.record(z.string(), z.unknown()).optional(),
});
export type AutosaveBody = z.infer<typeof AutosaveBody>;

export const AutosaveResult = z.object({
  applied: z.boolean(),
  savedSeq: z.number(),
  serverNow: z.iso.datetime(),
  deadlineAt: z.iso.datetime().nullable(),
});

export const SubmitBody = AutosaveBody.partial({ clientSeq: true, answers: true });
export type SubmitBody = z.infer<typeof SubmitBody>;

export const ServerTimeDto = z.object({ serverNow: z.iso.datetime(), epochMs: z.number() });

// ───── Annotations (highlight / note) ─────
export const AnnotationDto = z.object({
  id: Uuid,
  clientId: Uuid,
  kind: z.enum(['HIGHLIGHT', 'NOTE']),
  targetKind: z.enum(['PARAGRAPH', 'QUESTION', 'GROUP']),
  targetId: Uuid,
  field: z.string().nullable(),
  startOffset: z.number(),
  endOffset: z.number(),
  exact: z.string(),
  note: z.string().nullable(),
});
export type AnnotationDto = z.infer<typeof AnnotationDto>;

export const CreateAnnotationBody = z
  .strictObject({
    clientId: Uuid,
    kind: z.enum(['HIGHLIGHT', 'NOTE']),
    targetKind: z.enum(['PARAGRAPH', 'QUESTION', 'GROUP']),
    targetId: Uuid,
    field: z.string().max(120).nullable().default(null),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(1),
    exact: z.string().min(1).max(5000),
    prefix: z.string().max(64).default(''),
    suffix: z.string().max(64).default(''),
    note: z.string().max(2000).nullable().default(null),
  })
  .refine((b) => b.endOffset > b.startOffset, {
    path: ['endOffset'],
    message: 'endOffset phải lớn hơn startOffset',
  });
export type CreateAnnotationBody = z.infer<typeof CreateAnnotationBody>;

export const UpdateAnnotationBody = z.strictObject({
  note: z.string().max(2000).nullable().optional(),
  kind: z.enum(['HIGHLIGHT', 'NOTE']).optional(),
});

// ───── Result (after submit) ─────
export const ResultItem = z.object({
  questionId: Uuid,
  number: z.number(),
  partNumber: z.number(),
  type: QuestionType,
  prompt: z.string().nullable(),
  yours: z.string().nullable(),
  correct: z.string(),
  accepted: z.array(z.string()),
  isCorrect: z.boolean(),
  blank: z.boolean(),
  wordLimitExceeded: z.boolean(),
  explanation: z.string().nullable(),
  evidence: z
    .object({ paragraphId: z.string(), start: z.number(), end: z.number(), exact: z.string() })
    .nullable(),
});
export type ResultItem = z.infer<typeof ResultItem>;

export const AttemptResultDto = z.object({
  attempt: AttemptSummaryDto,
  bandTable: z.object({ kind: z.string(), version: z.number(), isReference: z.boolean() }).nullable(),
  previousBand: Band.nullable(),
  targetBand: Band.nullable(),
  items: z.array(ResultItem),
  byType: z.array(z.object({ type: QuestionType, correct: z.number(), total: z.number() })),
  byPart: z.array(
    z.object({
      partNumber: z.number(),
      correct: z.number(),
      total: z.number(),
      timeSpentMs: z.number(),
      suggestedMinutes: z.number().nullable(),
    }),
  ),
  timeSpentMs: z.number(),
});
export type AttemptResultDto = z.infer<typeof AttemptResultDto>;

export const SUBMIT_REASONS = SubmitReason.options;
