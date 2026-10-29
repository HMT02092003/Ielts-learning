// GENERATED from backend/src/shared by scripts/sync-shared.mjs — DO NOT EDIT.
// Per-type data for the 12 IELTS question types (spec §5).
//   QuestionGroup.config  — group-level data, NEVER contains answers
//   Question.content      — per-question data, NEVER contains answers
//   Question.correctAnswer / Answer.value — see CorrectAnswer / AnswerValue
import { z } from 'zod';
import type { QuestionType } from './enums';
import {
  HCell,
  HText,
  HeadingKey,
  HeadingOption,
  Option,
  ParagraphLabel,
  PlacedOption,
  Point,
  WordLimit,
} from './primitives';

export const TFNG_KEYS = ['TRUE', 'FALSE', 'NOT_GIVEN'] as const;
export const YNNG_KEYS = ['YES', 'NO', 'NOT_GIVEN'] as const;

// ───── Student answer (Answer.value) ─────
export const KeyValue = z.strictObject({ kind: z.literal('KEY'), key: z.string().min(1).max(12) });
export const TextValue = z.strictObject({ kind: z.literal('TEXT'), text: z.string().max(200) });
export const AnswerValue = z.discriminatedUnion('kind', [KeyValue, TextValue]);
export type AnswerValue = z.infer<typeof AnswerValue>;

// ───── Correct answer (Question.correctAnswer) ─────
export const KeyCorrect = z.strictObject({ kind: z.literal('KEY'), key: z.string().min(1).max(12) });
/** MULTIPLE_CHOICE_MULTI: the full correct set, copied onto every question of the group. */
export const KeysCorrect = z.strictObject({
  kind: z.literal('KEYS'),
  keys: z.array(z.string().min(1).max(12)).min(2).max(5),
});
/** `display` is shown on the result screen; matching uses Question.acceptedAnswers. */
export const TextCorrect = z.strictObject({ kind: z.literal('TEXT'), display: z.string().min(1).max(200) });
export const CorrectAnswer = z.discriminatedUnion('kind', [KeyCorrect, KeysCorrect, TextCorrect]);
export type CorrectAnswer = z.infer<typeof CorrectAnswer>;

// ───── Shared sub-schemas ─────
export const AnswerMode = z.enum(['WORDS', 'WORD_BANK']);
export const WordBank = z.strictObject({
  options: z.array(Option).min(2).max(15),
  allowReuse: z.boolean().default(false),
});

export const NoteTemplate = z.discriminatedUnion('layout', [
  z.strictObject({
    layout: z.literal('NOTES'),
    lines: z
      .array(
        z.strictObject({
          style: z.enum(['HEADING', 'BULLET', 'TEXT']),
          indent: z.number().int().min(0).max(3).default(0),
          text: HText(500), // may contain {{n}}
        }),
      )
      .min(1)
      .max(60),
  }),
  z.strictObject({
    layout: z.literal('TABLE'),
    columns: z.array(HCell(200)).min(1).max(6),
    rows: z
      .array(z.strictObject({ cells: z.array(HCell(500)) }))
      .min(1)
      .max(20), // v1 limitation: no col/row spans
  }),
  z.strictObject({
    layout: z.literal('FLOWCHART'),
    steps: z
      .array(z.strictObject({ text: HText(500) }))
      .min(2)
      .max(15), // v1 limitation: linear flow only
  }),
]);
export type NoteTemplate = z.infer<typeof NoteTemplate>;

// ───── Group config (QuestionGroup.config), discriminated on `type` ─────
const t = <T extends QuestionType>(type: T) => ({ type: z.literal(type) });

export const McSingleConfig = z.strictObject({ ...t('MULTIPLE_CHOICE_SINGLE') });
export const McMultiConfig = z.strictObject({
  ...t('MULTIPLE_CHOICE_MULTI'),
  stem: HText(1000),
  options: z.array(Option).min(3).max(10),
  chooseCount: z.number().int().min(2).max(5),
});
export const TfngConfig = z.strictObject({ ...t('TRUE_FALSE_NOT_GIVEN') });
export const YnngConfig = z.strictObject({ ...t('YES_NO_NOT_GIVEN') });
export const MatchingHeadingsConfig = z.strictObject({
  ...t('MATCHING_HEADINGS'),
  headings: z.array(HeadingOption).min(2).max(15),
  example: z
    .strictObject({ paragraphLabel: ParagraphLabel, headingKey: HeadingKey })
    .nullable()
    .default(null),
});
export const MatchingInformationConfig = z.strictObject({
  ...t('MATCHING_INFORMATION'),
  paragraphLabels: z.array(ParagraphLabel).min(2).max(12),
  allowReuse: z.boolean().default(true),
});
export const MatchingFeaturesConfig = z.strictObject({
  ...t('MATCHING_FEATURES'),
  /** SENTENCE_ENDINGS and CLASSIFICATION share the same mechanics: pick a key from a list. */
  variant: z.enum(['FEATURES', 'CLASSIFICATION', 'SENTENCE_ENDINGS']).default('FEATURES'),
  listTitle: HText(200).optional(),
  features: z.array(Option).min(2).max(12),
  allowReuse: z.boolean().default(false),
});
export const SentenceCompletionConfig = z.strictObject({ ...t('SENTENCE_COMPLETION'), wordLimit: WordLimit });
export const SummaryCompletionConfig = z.strictObject({
  ...t('SUMMARY_COMPLETION'),
  title: HText(200).optional(),
  text: HText(5000), // contains {{n}} for every question in the group
  answerMode: AnswerMode,
  wordLimit: WordLimit.optional(), // required iff WORDS
  wordBank: WordBank.optional(), // required iff WORD_BANK
});
export const NoteTableFlowchartConfig = z.strictObject({
  ...t('NOTE_TABLE_FLOWCHART_COMPLETION'),
  title: HText(200).optional(),
  template: NoteTemplate,
  answerMode: AnswerMode,
  wordLimit: WordLimit.optional(),
  wordBank: WordBank.optional(),
});
export const ShortAnswerConfig = z.strictObject({ ...t('SHORT_ANSWER'), wordLimit: WordLimit });
export const MapDiagramConfig = z.strictObject({
  ...t('MAP_DIAGRAM_LABELLING'),
  variant: z.enum(['MAP', 'PLAN', 'DIAGRAM']),
  /** OPTIONS: letters printed on the image, prompt = place name; WORDS: the student writes the label. */
  answerMode: z.enum(['OPTIONS', 'WORDS']),
  options: z.array(PlacedOption).min(2).max(15).optional(), // required iff OPTIONS
  wordLimit: WordLimit.optional(), // required iff WORDS
});

export const QuestionGroupConfig = z.discriminatedUnion('type', [
  McSingleConfig,
  McMultiConfig,
  TfngConfig,
  YnngConfig,
  MatchingHeadingsConfig,
  MatchingInformationConfig,
  MatchingFeaturesConfig,
  SentenceCompletionConfig,
  SummaryCompletionConfig,
  NoteTableFlowchartConfig,
  ShortAnswerConfig,
  MapDiagramConfig,
]);
export type QuestionGroupConfig = z.infer<typeof QuestionGroupConfig>;

// ───── Per-question content (Question.content) ─────
export const EmptyContent = z.strictObject({});
export const McSingleContent = z.strictObject({ options: z.array(Option).min(2).max(8) });
export const MatchingHeadingsContent = z.strictObject({ paragraphLabel: ParagraphLabel });
export const MapDiagramContent = z.strictObject({ pin: Point.optional() });

export const QUESTION_CONTENT_SCHEMA = {
  MULTIPLE_CHOICE_SINGLE: McSingleContent,
  MULTIPLE_CHOICE_MULTI: EmptyContent,
  TRUE_FALSE_NOT_GIVEN: EmptyContent,
  YES_NO_NOT_GIVEN: EmptyContent,
  MATCHING_HEADINGS: MatchingHeadingsContent,
  MATCHING_INFORMATION: EmptyContent,
  MATCHING_FEATURES: EmptyContent,
  SENTENCE_COMPLETION: EmptyContent,
  SUMMARY_COMPLETION: EmptyContent,
  NOTE_TABLE_FLOWCHART_COMPLETION: EmptyContent,
  SHORT_ANSWER: EmptyContent,
  MAP_DIAGRAM_LABELLING: MapDiagramContent,
} as const satisfies Record<QuestionType, z.ZodType>;

export type ValueKind = AnswerValue['kind'];

/** Which answer kind a student submits for a group. */
export function expectedValueKind(c: QuestionGroupConfig): ValueKind {
  switch (c.type) {
    case 'SENTENCE_COMPLETION':
    case 'SHORT_ANSWER':
      return 'TEXT';
    case 'SUMMARY_COMPLETION':
    case 'NOTE_TABLE_FLOWCHART_COMPLETION':
      return c.answerMode === 'WORD_BANK' ? 'KEY' : 'TEXT';
    case 'MAP_DIAGRAM_LABELLING':
      return c.answerMode === 'OPTIONS' ? 'KEY' : 'TEXT';
    case 'MULTIPLE_CHOICE_SINGLE':
    case 'MULTIPLE_CHOICE_MULTI':
    case 'TRUE_FALSE_NOT_GIVEN':
    case 'YES_NO_NOT_GIVEN':
    case 'MATCHING_HEADINGS':
    case 'MATCHING_INFORMATION':
    case 'MATCHING_FEATURES':
      return 'KEY';
    default: {
      const exhaustive: never = c;
      return exhaustive;
    }
  }
}

/** Keys a student may pick for one question; null = free text. */
export function allowedKeys(c: QuestionGroupConfig, content: unknown): string[] | null {
  switch (c.type) {
    case 'MULTIPLE_CHOICE_SINGLE':
      return McSingleContent.parse(content).options.map((o) => o.key);
    case 'MULTIPLE_CHOICE_MULTI':
      return c.options.map((o) => o.key);
    case 'TRUE_FALSE_NOT_GIVEN':
      return [...TFNG_KEYS];
    case 'YES_NO_NOT_GIVEN':
      return [...YNNG_KEYS];
    case 'MATCHING_HEADINGS':
      return c.headings.map((h) => h.key).filter((k) => k !== c.example?.headingKey);
    case 'MATCHING_INFORMATION':
      return c.paragraphLabels;
    case 'MATCHING_FEATURES':
      return c.features.map((f) => f.key);
    case 'SUMMARY_COMPLETION':
    case 'NOTE_TABLE_FLOWCHART_COMPLETION':
      return c.answerMode === 'WORD_BANK' ? (c.wordBank?.options.map((o) => o.key) ?? []) : null;
    case 'MAP_DIAGRAM_LABELLING':
      return c.answerMode === 'OPTIONS' ? (c.options?.map((o) => o.key) ?? []) : null;
    case 'SENTENCE_COMPLETION':
    case 'SHORT_ANSWER':
      return null;
    default: {
      const exhaustive: never = c;
      return exhaustive;
    }
  }
}
