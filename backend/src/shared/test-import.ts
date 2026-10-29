// TestImportDoc — the JSON document used for test import (admin JSON import, seed fixtures, OCR publish).
// Mapping to DB (modules/tests/import.service.ts):
//   group: type/instructions/questionFrom/questionTo → columns, image → imageId,
//          MC_MULTI `answer` → copied to every question's correctAnswer, every other key (+ type) → config
//   question: number/prompt/explanation/answer/accepted → columns, every other key → content
import { z } from 'zod';
import { TestSource, TestType, ParagraphKind, WritingTaskKind } from './enums';
import { formatIssuePath, type ValidationIssue } from './errors';
import {
  HText,
  HeadingKey,
  HeadingOption,
  NormalizedText,
  Option,
  OptionKey,
  ParagraphLabel,
  PlacedOption,
  Point,
  QuestionNumber,
  Sha256Hex,
  Uuid,
  WordLimit,
  blankNumbers,
} from './primitives';
import { AnswerMode, NoteTemplate, TFNG_KEYS, WordBank, YNNG_KEYS } from './question-types';

export const AssetPath = z
  .string()
  .regex(
    /^assets\/[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/,
    'path phải dạng assets/ten-file.ext (chữ thường)',
  );
export const FileRef = z.union([
  z.strictObject({ fileId: Uuid }),
  z.strictObject({ path: AssetPath, sha256: Sha256Hex.optional() }),
]);
export type FileRef = z.infer<typeof FileRef>;

/** "not given" / "Not Given" → "NOT_GIVEN" before enum check. */
const judgement = (keys: readonly [string, ...string[]]) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase().replace(/\s+/g, '_') : v),
    z.enum(keys),
  );

const QBase = {
  number: QuestionNumber,
  explanation: z.string().max(4000).optional(),
  /** Resolved at import to {paragraphId,start,end,exact}; error if the quote is not found. */
  evidence: z
    .strictObject({ paragraphLabel: ParagraphLabel.optional(), quote: z.string().min(3).max(1000) })
    .optional(),
};
const TextAns = {
  /** WORDS mode: the canonical answer ("(the) museum" allowed); WORD_BANK mode: the option key. */
  answer: z.string().trim().min(1).max(200),
  accepted: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
};
const GBase = { instructions: HText(2000), questionFrom: QuestionNumber, questionTo: QuestionNumber };

export const ImportGroup = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('MULTIPLE_CHOICE_SINGLE'),
    ...GBase,
    questions: z
      .array(
        z.strictObject({
          ...QBase,
          prompt: HText(1000),
          options: z.array(Option).min(2).max(8),
          answer: OptionKey,
        }),
      )
      .min(1),
  }),
  z.strictObject({
    type: z.literal('MULTIPLE_CHOICE_MULTI'),
    ...GBase,
    stem: HText(1000),
    options: z.array(Option).min(3).max(10),
    chooseCount: z.number().int().min(2).max(5),
    answer: z.array(OptionKey).min(2).max(5),
    questions: z.array(z.strictObject({ ...QBase })).min(2),
  }),
  z.strictObject({
    type: z.literal('TRUE_FALSE_NOT_GIVEN'),
    ...GBase,
    questions: z
      .array(z.strictObject({ ...QBase, prompt: HText(1000), answer: judgement(TFNG_KEYS) }))
      .min(1),
  }),
  z.strictObject({
    type: z.literal('YES_NO_NOT_GIVEN'),
    ...GBase,
    questions: z
      .array(z.strictObject({ ...QBase, prompt: HText(1000), answer: judgement(YNNG_KEYS) }))
      .min(1),
  }),
  z.strictObject({
    type: z.literal('MATCHING_HEADINGS'),
    ...GBase,
    headings: z.array(HeadingOption).min(2).max(15),
    example: z
      .strictObject({ paragraphLabel: ParagraphLabel, headingKey: HeadingKey })
      .nullable()
      .default(null),
    questions: z
      .array(z.strictObject({ ...QBase, paragraphLabel: ParagraphLabel, answer: HeadingKey }))
      .min(1),
  }),
  z.strictObject({
    type: z.literal('MATCHING_INFORMATION'),
    ...GBase,
    paragraphLabels: z.array(ParagraphLabel).min(2).max(12),
    allowReuse: z.boolean().default(true),
    questions: z.array(z.strictObject({ ...QBase, prompt: HText(1000), answer: ParagraphLabel })).min(1),
  }),
  z.strictObject({
    type: z.literal('MATCHING_FEATURES'),
    ...GBase,
    variant: z.enum(['FEATURES', 'CLASSIFICATION', 'SENTENCE_ENDINGS']).default('FEATURES'),
    listTitle: HText(200).optional(),
    features: z.array(Option).min(2).max(12),
    allowReuse: z.boolean().default(false),
    questions: z.array(z.strictObject({ ...QBase, prompt: HText(1000), answer: OptionKey })).min(1),
  }),
  z.strictObject({
    type: z.literal('SENTENCE_COMPLETION'),
    ...GBase,
    wordLimit: WordLimit,
    questions: z.array(z.strictObject({ ...QBase, prompt: HText(1000), ...TextAns })).min(1),
  }),
  z.strictObject({
    type: z.literal('SUMMARY_COMPLETION'),
    ...GBase,
    title: HText(200).optional(),
    text: HText(5000),
    answerMode: AnswerMode,
    wordLimit: WordLimit.optional(),
    wordBank: WordBank.optional(),
    questions: z.array(z.strictObject({ ...QBase, ...TextAns })).min(1),
  }),
  z.strictObject({
    type: z.literal('NOTE_TABLE_FLOWCHART_COMPLETION'),
    ...GBase,
    title: HText(200).optional(),
    template: NoteTemplate,
    answerMode: AnswerMode,
    wordLimit: WordLimit.optional(),
    wordBank: WordBank.optional(),
    image: FileRef.optional(),
    questions: z.array(z.strictObject({ ...QBase, ...TextAns })).min(1),
  }),
  z.strictObject({
    type: z.literal('SHORT_ANSWER'),
    ...GBase,
    wordLimit: WordLimit,
    questions: z.array(z.strictObject({ ...QBase, prompt: HText(1000), ...TextAns })).min(1),
  }),
  z.strictObject({
    type: z.literal('MAP_DIAGRAM_LABELLING'),
    ...GBase,
    variant: z.enum(['MAP', 'PLAN', 'DIAGRAM']),
    answerMode: z.enum(['OPTIONS', 'WORDS']),
    image: FileRef,
    options: z.array(PlacedOption).min(2).max(15).optional(),
    wordLimit: WordLimit.optional(),
    questions: z
      .array(z.strictObject({ ...QBase, prompt: HText(500).optional(), pin: Point.optional(), ...TextAns }))
      .min(1),
  }),
]);
export type ImportGroup = z.infer<typeof ImportGroup>;

export const ImportParagraph = z.strictObject({
  label: ParagraphLabel.optional(),
  kind: ParagraphKind.default('BODY'),
  text: NormalizedText,
  image: FileRef.optional(),
});
export const ImportPassage = z.strictObject({
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().max(300).optional(),
  instructions: z.string().trim().max(1000).optional(),
  suggestedMinutes: z.number().int().min(1).max(60).optional(),
  paragraphs: z.array(ImportParagraph).min(1).max(40),
  groups: z.array(ImportGroup).min(1).max(8),
});
export const ImportListeningPart = z.strictObject({
  title: z.string().trim().max(300).optional(),
  instructions: z.string().trim().max(1000).optional(),
  audio: z.strictObject({
    file: FileRef,
    durationMs: z.number().int().positive(),
    startMs: z.number().int().min(0).optional(),
    endMs: z.number().int().positive().optional(),
    transcript: z.string().max(50_000).optional(),
  }),
  groups: z.array(ImportGroup).min(1).max(6),
});
export const WritingVisual = z.enum(['LINE', 'BAR', 'PIE', 'TABLE', 'MAP', 'PROCESS', 'MIXED']);
export const ImportWritingTask = z.strictObject({
  task: z.union([z.literal(1), z.literal(2)]),
  kind: WritingTaskKind,
  prompt: z.string().trim().min(1).max(5000),
  image: FileRef.optional(),
  visual: WritingVisual.optional(),
  minWords: z.number().int().positive(),
  suggestedMinutes: z.number().int().positive(),
});
export const SpeakingCueCard = z.strictObject({
  topic: z.string().trim().min(1),
  bullets: z.array(z.string().trim().min(1)).min(1).max(6),
  closing: z.string().trim().optional(),
});
export const ImportSpeakingPart = z.discriminatedUnion('part', [
  z.strictObject({
    part: z.literal(1),
    topic: z.string().trim().optional(),
    questions: z.array(z.string().trim().min(1)).min(1),
  }),
  z.strictObject({
    part: z.literal(2),
    cueCard: SpeakingCueCard,
    prepSeconds: z.number().int().min(0).default(60),
    speakSeconds: z.number().int().positive().default(120),
    followUps: z.array(z.string().trim().min(1)).default([]),
  }),
  z.strictObject({
    part: z.literal(3),
    topic: z.string().trim().optional(),
    questions: z.array(z.string().trim().min(1)).min(1),
  }),
]);

const TestImportDocBase = z.strictObject({
  schemaVersion: z.literal(1),
  seriesKey: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{2,63}$/, 'seriesKey: chữ thường, số, dấu gạch ngang (3–64 ký tự)'),
  source: TestSource,
  type: TestType,
  title: z.string().trim().min(1).max(300),
  sourceRef: z.string().trim().max(300).optional(),
  bookNumber: z.number().int().positive().optional(),
  testNumber: z.number().int().positive().optional(),
  description: z.string().max(2000).optional(),
  reading: z.strictObject({ passages: z.array(ImportPassage).min(1).max(3) }).optional(),
  listening: z.strictObject({ parts: z.array(ImportListeningPart).min(1).max(4) }).optional(),
  writing: z.strictObject({ tasks: z.array(ImportWritingTask).min(1).max(2) }).optional(),
  speaking: z.strictObject({ parts: z.array(ImportSpeakingPart).min(1).max(3) }).optional(),
});

type Issue = { path: (string | number)[]; message: string };

/** Structural cross-field checks shared by draft and publish validation. */
function crossChecks(doc: z.infer<typeof TestImportDocBase>): Issue[] {
  const issues: Issue[] = [];
  if (!doc.reading && !doc.listening && !doc.writing && !doc.speaking) {
    issues.push({ path: [], message: 'Đề phải có ít nhất một kỹ năng' });
  }
  const sectionGroups: { base: (string | number)[]; groups: ImportGroup[]; labels: Set<string> | null }[] =
    [];
  doc.reading?.passages.forEach((p, pi) => {
    const labels = new Set(p.paragraphs.flatMap((para) => (para.label ? [para.label] : [])));
    const seen = new Set<string>();
    p.paragraphs.forEach((para, i) => {
      if (para.label && seen.has(para.label)) {
        issues.push({
          path: ['reading', 'passages', pi, 'paragraphs', i, 'label'],
          message: `Nhãn đoạn "${para.label}" bị trùng`,
        });
      }
      if (para.label) seen.add(para.label);
    });
    sectionGroups.push({ base: ['reading', 'passages', pi], groups: p.groups, labels });
  });
  doc.listening?.parts.forEach((p, pi) =>
    sectionGroups.push({ base: ['listening', 'parts', pi], groups: p.groups, labels: null }),
  );

  // Numbering is unique within each section (reading / listening).
  for (const skill of ['reading', 'listening'] as const) {
    const numbers = new Map<number, string>();
    for (const { base, groups } of sectionGroups.filter((s) => s.base[0] === skill)) {
      groups.forEach((g, gi) =>
        g.questions.forEach((q, qi) => {
          const path = [...base, 'groups', gi, 'questions', qi, 'number'];
          const prev = numbers.get(q.number);
          if (prev) issues.push({ path, message: `Câu ${q.number} bị trùng (đã có ở ${prev})` });
          else numbers.set(q.number, formatIssuePath(path));
        }),
      );
    }
  }

  for (const { base, groups, labels } of sectionGroups) {
    groups.forEach((g, gi) => issues.push(...groupChecks(g, [...base, 'groups', gi], labels)));
  }
  return issues;
}

function groupChecks(
  g: ImportGroup,
  path: (string | number)[],
  paragraphLabels: Set<string> | null,
): Issue[] {
  const issues: Issue[] = [];
  const at = (...rest: (string | number)[]) => [...path, ...rest];
  const nums = g.questions.map((q) => q.number);
  const expected = Array.from({ length: g.questionTo - g.questionFrom + 1 }, (_, i) => g.questionFrom + i);
  if (g.questionFrom > g.questionTo) {
    issues.push({ path: at('questionTo'), message: 'questionTo phải ≥ questionFrom' });
  } else if (nums.length !== expected.length || !expected.every((n, i) => nums[i] === n)) {
    issues.push({
      path: at('questions'),
      message: `Các câu phải đúng thứ tự ${g.questionFrom}–${g.questionTo} (đang có: ${nums.join(', ')})`,
    });
  }
  const requireOne = (mode: string, wordLimit: unknown, wordBank: unknown) => {
    if (mode === 'WORDS' && !wordLimit)
      issues.push({ path: at('wordLimit'), message: 'answerMode WORDS cần wordLimit' });
    if (mode === 'WORD_BANK' && !wordBank)
      issues.push({ path: at('wordBank'), message: 'answerMode WORD_BANK cần wordBank' });
  };
  const keyIn = (keys: string[], answer: string, qi: number, field = 'answer') => {
    if (!keys.includes(answer)) {
      issues.push({
        path: at('questions', qi, field),
        message: `"${answer}" không nằm trong danh sách: ${keys.join(', ')}`,
      });
    }
  };
  const blanksMatch = (text: string, field: (string | number)[]) => {
    const found = blankNumbers(text).sort((a, b) => a - b);
    if (found.join(',') !== nums.join(',')) {
      issues.push({
        path: at(...field),
        message: `Ô trống {{n}} (${found.join(', ') || 'không có'}) không khớp số câu (${nums.join(', ')})`,
      });
    }
  };

  switch (g.type) {
    case 'MULTIPLE_CHOICE_SINGLE':
      g.questions.forEach((q, qi) =>
        keyIn(
          q.options.map((o) => o.key),
          q.answer,
          qi,
        ),
      );
      break;
    case 'MULTIPLE_CHOICE_MULTI': {
      const keys = g.options.map((o) => o.key);
      if (g.answer.length !== g.chooseCount)
        issues.push({ path: at('answer'), message: `Cần đúng ${g.chooseCount} đáp án` });
      if (g.questions.length !== g.chooseCount) {
        issues.push({
          path: at('questions'),
          message: `Nhóm "chọn ${g.chooseCount}" phải có ${g.chooseCount} câu`,
        });
      }
      if (new Set(g.answer).size !== g.answer.length)
        issues.push({ path: at('answer'), message: 'Đáp án bị trùng' });
      g.answer.forEach((a, ai) => {
        if (!keys.includes(a))
          issues.push({ path: at('answer', ai), message: `"${a}" không nằm trong options` });
      });
      break;
    }
    case 'MATCHING_HEADINGS': {
      const keys = g.headings.map((h) => h.key);
      g.questions.forEach((q, qi) => {
        keyIn(keys, q.answer, qi);
        if (paragraphLabels && !paragraphLabels.has(q.paragraphLabel)) {
          issues.push({
            path: at('questions', qi, 'paragraphLabel'),
            message: `Bài đọc không có đoạn "${q.paragraphLabel}"`,
          });
        }
      });
      break;
    }
    case 'MATCHING_INFORMATION':
      g.questions.forEach((q, qi) => keyIn(g.paragraphLabels, q.answer, qi));
      if (paragraphLabels) {
        g.paragraphLabels.forEach((l, li) => {
          if (!paragraphLabels.has(l))
            issues.push({ path: at('paragraphLabels', li), message: `Bài đọc không có đoạn "${l}"` });
        });
      }
      break;
    case 'MATCHING_FEATURES':
      g.questions.forEach((q, qi) =>
        keyIn(
          g.features.map((f) => f.key),
          q.answer,
          qi,
        ),
      );
      break;
    case 'SENTENCE_COMPLETION':
    case 'SHORT_ANSWER':
      break;
    case 'SUMMARY_COMPLETION':
      requireOne(g.answerMode, g.wordLimit, g.wordBank);
      blanksMatch(g.text, ['text']);
      if (g.answerMode === 'WORD_BANK' && g.wordBank) {
        const keys = g.wordBank.options.map((o) => o.key);
        g.questions.forEach((q, qi) => keyIn(keys, q.answer.toUpperCase(), qi));
      }
      break;
    case 'NOTE_TABLE_FLOWCHART_COMPLETION': {
      requireOne(g.answerMode, g.wordLimit, g.wordBank);
      const tpl = g.template;
      const text =
        tpl.layout === 'NOTES'
          ? tpl.lines.map((l) => l.text).join('\n')
          : tpl.layout === 'TABLE'
            ? tpl.rows.flatMap((r) => r.cells).join('\n')
            : tpl.steps.map((s) => s.text).join('\n');
      blanksMatch(text, ['template']);
      if (g.answerMode === 'WORD_BANK' && g.wordBank) {
        const keys = g.wordBank.options.map((o) => o.key);
        g.questions.forEach((q, qi) => keyIn(keys, q.answer.toUpperCase(), qi));
      }
      break;
    }
    case 'MAP_DIAGRAM_LABELLING':
      if (g.answerMode === 'OPTIONS') {
        if (!g.options) issues.push({ path: at('options'), message: 'answerMode OPTIONS cần options' });
        else
          g.questions.forEach((q, qi) =>
            keyIn(g.options?.map((o) => o.key) ?? [], q.answer.toUpperCase(), qi),
          );
      } else if (!g.wordLimit) {
        issues.push({ path: at('wordLimit'), message: 'answerMode WORDS cần wordLimit' });
      }
      break;
    case 'TRUE_FALSE_NOT_GIVEN':
    case 'YES_NO_NOT_GIVEN':
      break;
    default: {
      const exhaustive: never = g;
      return exhaustive;
    }
  }
  return issues;
}

/** Draft-level validation: structure + cross references. Enough to save a DRAFT test. */
export const TestImportDoc = TestImportDocBase.superRefine((doc, ctx) => {
  for (const issue of crossChecks(doc))
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
});
export type TestImportDoc = z.infer<typeof TestImportDoc>;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Publish-level checks on an already-parsed doc: complete sections, numbering 1–40. */
export function checkPublishable(doc: TestImportDoc): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const add = (path: string, message: string) => out.push({ path, code: 'not_publishable', message });
  const numbersOk = (groups: ImportGroup[]) =>
    groups
      .flatMap((g) => g.questions.map((q) => q.number))
      .sort((a, b) => a - b)
      .join(',') === range(1, 40).join(',');

  if (doc.reading) {
    if (doc.reading.passages.length !== 3) add('reading.passages', 'Reading phải có đúng 3 passage');
    if (!numbersOk(doc.reading.passages.flatMap((p) => p.groups))) add('reading', 'Reading phải đủ câu 1–40');
  }
  if (doc.listening) {
    if (doc.listening.parts.length !== 4) add('listening.parts', 'Listening phải có đúng 4 part');
    if (!numbersOk(doc.listening.parts.flatMap((p) => p.groups)))
      add('listening', 'Listening phải đủ câu 1–40');
  }
  if (doc.writing) {
    const tasks = doc.writing.tasks.map((t) => t.task).sort();
    if (tasks.join(',') !== '1,2') add('writing.tasks', 'Writing phải có Task 1 và Task 2');
  }
  if (doc.speaking) {
    const parts = doc.speaking.parts.map((p) => p.part).sort();
    if (parts.join(',') !== '1,2,3') add('speaking.parts', 'Speaking phải có Part 1, 2 và 3');
  }
  return out;
}
