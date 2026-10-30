// Writing + Speaking contracts (Phase 5). Every machine evaluation is an ESTIMATE ("ƯỚC LƯỢNG, không thay thế
// giám khảo"): only Lexical Resource and Grammar get a heuristic band; Task Response / Coherence are checklist-only.
import { z } from 'zod';
import { EvaluationStatus, EvaluatorKind, WritingTaskKind } from './enums';
import { Band, Uuid } from './primitives';

export const ESTIMATE_DISCLAIMER = 'ƯỚC LƯỢNG, không thay thế giám khảo';

// ───── Writing: saving ─────
export const WritingSaveBody = z.strictObject({
  clientSeq: z.number().int().min(1),
  text: z.string().max(30_000),
});
export type WritingSaveBody = z.infer<typeof WritingSaveBody>;

export const WritingPartParams = z.strictObject({ id: Uuid, partId: Uuid });

// ───── Self checklist (Task Response / Coherence & Cohesion) ─────
export const WRITING_CHECKLIST = [
  { key: 'tr_all_parts', criterion: 'TR', label: 'Trả lời đủ mọi phần của đề' },
  { key: 'tr_position', criterion: 'TR', label: 'Quan điểm / tổng quan rõ ràng, nhất quán' },
  { key: 'tr_support', criterion: 'TR', label: 'Ý chính có giải thích và ví dụ cụ thể' },
  { key: 'tr_length', criterion: 'TR', label: 'Đủ số từ tối thiểu' },
  { key: 'cc_paragraphs', criterion: 'CC', label: 'Chia đoạn hợp lý, mỗi đoạn một ý chính' },
  { key: 'cc_linking', criterion: 'CC', label: 'Từ nối đa dạng, không lạm dụng' },
  { key: 'cc_reference', criterion: 'CC', label: 'Dùng đại từ / thay thế để tránh lặp' },
  { key: 'cc_progression', criterion: 'CC', label: 'Ý phát triển logic từ đầu đến cuối' },
] as const;
export type ChecklistKey = (typeof WRITING_CHECKLIST)[number]['key'];

export const ChecklistBody = z.strictObject({
  checklist: z.record(z.string().max(40), z.boolean()),
});

// ───── Evaluation result ─────
export const WritingIssue = z.object({
  offset: z.number().int().min(0),
  length: z.number().int().min(0),
  category: z.enum(['GRAMMAR', 'SPELLING', 'PUNCTUATION', 'STYLE', 'OTHER']),
  message: z.string(),
  replacements: z.array(z.string()),
  ruleId: z.string(),
});
export type WritingIssue = z.infer<typeof WritingIssue>;

export const WritingMetrics = z.object({
  words: z.number(),
  sentences: z.number(),
  paragraphs: z.number(),
  avgSentenceLength: z.number(),
  typeTokenRatio: z.number(),
  repetitionRate: z.number(),
  linkingWords: z.number(),
  distinctLinkingWords: z.number(),
  complexSentenceRatio: z.number(),
  longWordRatio: z.number(),
  errorsPer100Words: z.number(),
});
export type WritingMetrics = z.infer<typeof WritingMetrics>;

export const CriterionEstimate = z.object({ band: Band.nullable(), evidence: z.array(z.string()) });

export const WritingEvaluationResult = z.object({
  method: z.enum(['HEURISTIC', 'LLM', 'HUMAN']),
  isEstimate: z.boolean(),
  disclaimer: z.string(),
  degraded: z.boolean(),
  warnings: z.array(z.string()),
  issues: z.array(WritingIssue),
  metrics: WritingMetrics,
  criteria: z.object({
    taskResponse: z.object({ band: z.null(), checklistOnly: z.literal(true) }),
    coherence: z.object({ band: z.null(), checklistOnly: z.literal(true) }),
    lexical: CriterionEstimate,
    grammar: CriterionEstimate,
  }),
});
export type WritingEvaluationResult = z.infer<typeof WritingEvaluationResult>;

export const WritingEvaluationDto = z.object({
  id: Uuid,
  evaluator: EvaluatorKind,
  evaluatorVersion: z.string(),
  status: EvaluationStatus,
  isEstimate: z.boolean(),
  bandTaskResponse: Band.nullable(),
  bandCoherence: Band.nullable(),
  bandLexical: Band.nullable(),
  bandGrammar: Band.nullable(),
  bandOverall: Band.nullable(),
  result: WritingEvaluationResult.nullable(),
  comment: z.string().nullable(),
  reviewerName: z.string().nullable(),
  error: z.string().nullable(),
  textHash: z.string(),
  createdAt: z.iso.datetime(),
});
export type WritingEvaluationDto = z.infer<typeof WritingEvaluationDto>;

export const WritingSubmissionDto = z.object({
  id: Uuid,
  attemptId: Uuid,
  partId: Uuid,
  partNumber: z.number(),
  testTitle: z.string(),
  userName: z.string(),
  taskKind: WritingTaskKind,
  prompt: z.string(),
  imageId: Uuid.nullable(),
  minWords: z.number(),
  text: z.string(),
  wordCount: z.number(),
  status: z.enum(['DRAFT', 'SUBMITTED']),
  lastClientSeq: z.number(),
  submittedAt: z.iso.datetime().nullable(),
  selfChecklist: z.record(z.string(), z.boolean()),
  evaluations: z.array(WritingEvaluationDto),
});
export type WritingSubmissionDto = z.infer<typeof WritingSubmissionDto>;

export const WritingSaveResult = z.object({
  applied: z.boolean(),
  savedSeq: z.number(),
  wordCount: z.number(),
  serverNow: z.iso.datetime(),
});

export const HumanWritingReviewBody = z.strictObject({
  bandTaskResponse: Band,
  bandCoherence: Band,
  bandLexical: Band,
  bandGrammar: Band,
  comment: z.string().trim().max(5000).default(''),
});
export type HumanWritingReviewBody = z.infer<typeof HumanWritingReviewBody>;

/**
 * Mean of four criterion bands rounded to the nearest half band (x.25 → x.5, x.75 → x+1), the same convention
 * IELTS uses for the overall score. A simplification for one task / one speaking test; the grader may override.
 */
export function meanBand(bands: number[]): number {
  return Math.round((bands.reduce((a, b) => a + b, 0) / bands.length) * 2) / 2;
}

// ───── Speaking ─────
export const SpeakingRecordingDto = z.object({
  id: Uuid,
  partId: Uuid,
  partNumber: z.number(),
  questionIndex: z.number(),
  take: z.number(),
  fileId: Uuid,
  mimeType: z.string(),
  durationMs: z.number().nullable(),
  createdAt: z.iso.datetime(),
});
export type SpeakingRecordingDto = z.infer<typeof SpeakingRecordingDto>;

export const SpeakingEvaluationDto = z.object({
  id: Uuid,
  evaluator: EvaluatorKind,
  isEstimate: z.boolean(),
  bandFluency: Band.nullable(),
  bandLexical: Band.nullable(),
  bandGrammar: Band.nullable(),
  bandPronunciation: Band.nullable(),
  bandOverall: Band.nullable(),
  comment: z.string().nullable(),
  reviewerName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type SpeakingEvaluationDto = z.infer<typeof SpeakingEvaluationDto>;

export const SpeakingAttemptDto = z.object({
  attemptId: Uuid,
  testTitle: z.string(),
  userName: z.string(),
  status: z.string(),
  submittedAt: z.iso.datetime().nullable(),
  recordings: z.array(SpeakingRecordingDto),
  evaluations: z.array(SpeakingEvaluationDto),
});
export type SpeakingAttemptDto = z.infer<typeof SpeakingAttemptDto>;

export const RecordingUploadFields = z.object({
  partId: Uuid,
  questionIndex: z.coerce.number().int().min(0).max(20).default(0),
  durationMs: z.coerce
    .number()
    .int()
    .min(0)
    .max(30 * 60_000)
    .optional(),
});

export const HumanSpeakingReviewBody = z.strictObject({
  bandFluency: Band,
  bandLexical: Band,
  bandGrammar: Band,
  bandPronunciation: Band,
  comment: z.string().trim().max(5000).default(''),
});
export type HumanSpeakingReviewBody = z.infer<typeof HumanSpeakingReviewBody>;

// ───── Admin grading queue ─────
export const GradingQueueQuery = z.object({
  kind: z.enum(['WRITING', 'SPEAKING']).default('WRITING'),
  status: z.enum(['PENDING', 'REVIEWED', 'ALL']).default('PENDING'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const GradingQueueItem = z.object({
  kind: z.enum(['WRITING', 'SPEAKING']),
  id: Uuid,
  attemptId: Uuid,
  userName: z.string(),
  testTitle: z.string(),
  label: z.string(),
  submittedAt: z.iso.datetime().nullable(),
  reviewed: z.boolean(),
  bandOverall: Band.nullable(),
});
export type GradingQueueItem = z.infer<typeof GradingQueueItem>;
