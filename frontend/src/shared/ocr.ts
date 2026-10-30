// GENERATED from backend/src/shared by scripts/sync-shared.mjs — DO NOT EDIT.
// OCR import contracts (Phase 2). OCR output never goes into test tables by itself (spec §6 P2):
// an admin reviews blocks, tags them, fills the answer key, then "assemble" builds a TestImportDoc draft.
import { z } from 'zod';
import { OcrJobStatus, OcrMethod, OcrPageReview, TestSource, TestType } from './enums';
import { Uuid } from './primitives';

/** Box in 0..1 page coordinates (resolution independent). */
export const BBox = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
export type BBox = z.infer<typeof BBox>;

export const OcrWord = z.object({ start: z.number().int(), end: z.number().int(), confidence: z.number() });

/** Raw engine output for one text block (paragraph). confidence is null for a PDF text layer. */
export const OcrBlock = z.object({
  id: z.string(),
  bbox: BBox,
  text: z.string(),
  confidence: z.number().nullable(),
  lowConfidenceWords: z.array(OcrWord),
});
export type OcrBlock = z.infer<typeof OcrBlock>;

export const OcrTag = z.enum(['PASSAGE', 'QUESTION', 'OPTION', 'ANSWER', 'INSTRUCTION', 'IGNORE']);
export type OcrTag = z.infer<typeof OcrTag>;

/** One block as edited in the review screen. `pageNumber` + `sourceIds` keep the link to the original blocks. */
export const ReviewBlock = z.strictObject({
  id: z.string().min(1).max(64),
  pageNumber: z.number().int().min(1),
  sourceIds: z.array(z.string()).max(50),
  tag: OcrTag,
  text: z.string().max(20_000),
});
export type ReviewBlock = z.infer<typeof ReviewBlock>;

export const OcrReviewDraft = z.strictObject({
  blocks: z.array(ReviewBlock).max(2000),
  /** Question number (1..40) → accepted answers (first = canonical). */
  answerKey: z.record(z.string().regex(/^\d{1,2}$/), z.array(z.string().max(200)).max(20)),
  /** The test document assembled from the blocks, edited as JSON before publishing. */
  doc: z.unknown().optional(),
});
export type OcrReviewDraft = z.infer<typeof OcrReviewDraft>;

export const OcrPageDto = z.object({
  id: Uuid,
  pageNumber: z.number(),
  imageFileId: Uuid,
  widthPx: z.number(),
  heightPx: z.number(),
  rotation: z.number(),
  method: OcrMethod,
  meanConfidence: z.number().nullable(),
  blocks: z.array(OcrBlock),
  reviewStatus: OcrPageReview,
});
export type OcrPageDto = z.infer<typeof OcrPageDto>;

export const OcrJobDto = z.object({
  id: Uuid,
  title: z.string().nullable(),
  status: OcrJobStatus,
  method: OcrMethod.nullable(),
  progress: z.number(),
  attempts: z.number(),
  pageCount: z.number().nullable(),
  meanConfidence: z.number().nullable(),
  lastError: z.string().nullable(),
  draftVersion: z.number(),
  importedTestId: Uuid.nullable(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});
export type OcrJobDto = z.infer<typeof OcrJobDto>;

export const OcrJobDetailDto = OcrJobDto.extend({
  pages: z.array(OcrPageDto),
  reviewDraft: OcrReviewDraft.nullable(),
});
export type OcrJobDetailDto = z.infer<typeof OcrJobDetailDto>;

export const CreateOcrJobBody = z.strictObject({ title: z.string().trim().max(200).optional() });

export const SaveReviewBody = z.strictObject({
  draftVersion: z.number().int().min(0),
  draft: OcrReviewDraft,
});
export type SaveReviewBody = z.infer<typeof SaveReviewBody>;

export const AssembleMeta = z.strictObject({
  seriesKey: z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/),
  title: z.string().trim().min(1).max(300),
  source: TestSource,
  type: TestType,
  sourceRef: z.string().trim().max(300).optional(),
});
export type AssembleMeta = z.infer<typeof AssembleMeta>;

export const PublishOcrBody = z.strictObject({ publishNow: z.boolean().default(false) });

export const RotatePageBody = z.strictObject({
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
});
