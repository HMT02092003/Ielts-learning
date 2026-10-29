// GENERATED from backend/src/shared by scripts/sync-shared.mjs — DO NOT EDIT.
// Mirrors the Prisma enums (checked by tests/unit/enum-parity.test.ts).
// This folder is copied verbatim to frontend/src/shared — it may only import `zod` and sibling files.
import { z } from 'zod';

export const Role = z.enum(['ADMIN', 'STUDENT']);
export type Role = z.infer<typeof Role>;

export const TestSource = z.enum(['CAM', 'VOL', 'PRE_IELTS', 'CUSTOM']);
export type TestSource = z.infer<typeof TestSource>;

/** Display/sort priority (spec §1: CAM → VOL → Pre-IELTS). Never rely on DB enum order. */
export const SOURCE_PRIORITY: Record<TestSource, number> = { CAM: 0, VOL: 1, PRE_IELTS: 2, CUSTOM: 3 };

export const TestType = z.enum(['ACADEMIC', 'GENERAL']);
export type TestType = z.infer<typeof TestType>;

export const TestStatus = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export type TestStatus = z.infer<typeof TestStatus>;

export const Skill = z.enum(['LISTENING', 'READING', 'WRITING', 'SPEAKING']);
export type Skill = z.infer<typeof Skill>;

export const ParagraphKind = z.enum(['BODY', 'HEADING', 'SUBHEADING', 'FIGURE', 'FOOTNOTE']);
export type ParagraphKind = z.infer<typeof ParagraphKind>;

export const QuestionType = z.enum([
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTI',
  'TRUE_FALSE_NOT_GIVEN',
  'YES_NO_NOT_GIVEN',
  'MATCHING_HEADINGS',
  'MATCHING_INFORMATION',
  'MATCHING_FEATURES',
  'SENTENCE_COMPLETION',
  'SUMMARY_COMPLETION',
  'NOTE_TABLE_FLOWCHART_COMPLETION',
  'SHORT_ANSWER',
  'MAP_DIAGRAM_LABELLING',
]);
export type QuestionType = z.infer<typeof QuestionType>;

export const WritingTaskKind = z.enum(['ACADEMIC_REPORT', 'GENERAL_LETTER', 'ESSAY']);
export type WritingTaskKind = z.infer<typeof WritingTaskKind>;

export const AttemptMode = z.enum(['EXAM', 'PRACTICE']);
export type AttemptMode = z.infer<typeof AttemptMode>;

export const AttemptScope = z.enum(['SECTION', 'PART', 'QUESTION_TYPE', 'QUESTION_IDS']);
export type AttemptScope = z.infer<typeof AttemptScope>;

export const AttemptStatus = z.enum(['CREATED', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED']);
export type AttemptStatus = z.infer<typeof AttemptStatus>;

export const SubmitReason = z.enum(['USER', 'DEADLINE', 'ADMIN']);
export type SubmitReason = z.infer<typeof SubmitReason>;

export const AnnotationKind = z.enum(['HIGHLIGHT', 'NOTE']);
export type AnnotationKind = z.infer<typeof AnnotationKind>;

export const AnnotationTargetKind = z.enum(['PARAGRAPH', 'QUESTION', 'GROUP']);
export type AnnotationTargetKind = z.infer<typeof AnnotationTargetKind>;

export const WritingSubmissionStatus = z.enum(['DRAFT', 'SUBMITTED']);
export type WritingSubmissionStatus = z.infer<typeof WritingSubmissionStatus>;

export const EvaluatorKind = z.enum(['LIBRARY', 'LLM', 'HUMAN']);
export type EvaluatorKind = z.infer<typeof EvaluatorKind>;

export const EvaluationStatus = z.enum(['PENDING', 'RUNNING', 'DONE', 'FAILED']);
export type EvaluationStatus = z.infer<typeof EvaluationStatus>;

export const StorageDriver = z.enum(['LOCAL', 'S3']);
export type StorageDriver = z.infer<typeof StorageDriver>;

export const FilePurpose = z.enum([
  'TEST_AUDIO',
  'TEST_IMAGE',
  'SPEAKING_RECORDING',
  'OCR_SOURCE',
  'OCR_PAGE',
]);
export type FilePurpose = z.infer<typeof FilePurpose>;

export const OcrJobStatus = z.enum(['QUEUED', 'RUNNING', 'NEEDS_REVIEW', 'FAILED', 'IMPORTED']);
export type OcrJobStatus = z.infer<typeof OcrJobStatus>;

export const OcrMethod = z.enum(['PDF_TEXT', 'TESSERACT', 'MIXED']);
export type OcrMethod = z.infer<typeof OcrMethod>;

export const BandTableKind = z.enum(['LISTENING', 'READING_ACADEMIC', 'READING_GENERAL']);
export type BandTableKind = z.infer<typeof BandTableKind>;

export const VocabState = z.enum(['NEW', 'LEARNING', 'REVIEW', 'RELEARNING']);
export type VocabState = z.infer<typeof VocabState>;

export const OcrPageReview = z.enum(['PENDING', 'APPROVED']);
export type OcrPageReview = z.infer<typeof OcrPageReview>;

/** Every enum above, keyed by its Prisma name — used by the parity test. */
export const ALL_ENUMS = {
  Role,
  TestSource,
  TestType,
  TestStatus,
  Skill,
  ParagraphKind,
  QuestionType,
  WritingTaskKind,
  AttemptMode,
  AttemptScope,
  AttemptStatus,
  SubmitReason,
  AnnotationKind,
  AnnotationTargetKind,
  WritingSubmissionStatus,
  EvaluatorKind,
  EvaluationStatus,
  StorageDriver,
  FilePurpose,
  OcrJobStatus,
  OcrMethod,
  BandTableKind,
  VocabState,
  OcrPageReview,
} as const;
