import { createHash } from 'node:crypto';
import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/errors';
import { expandOptionalParts, fitsWordLimit, normalizeForCompare } from '../../lib/scoring/text';
import type { FilePurpose, Skill, TestStatus } from '../../shared/enums';
import { zodIssues, type ValidationIssue } from '../../shared/errors';
import { normalizeText, type WordLimit } from '../../shared/primitives';
import type { CorrectAnswer } from '../../shared/question-types';
import { checkPublishable, TestImportDoc, type FileRef, type ImportGroup } from '../../shared/test-import';

/** Resolves a FileRef to a StoredFile id of the given purpose (seed: generated assets; admin: uploads). */
export type FileResolver = (ref: FileRef, purpose: FilePurpose, path: string) => Promise<string>;

const DEFAULT_SECTION_SECONDS: Record<Skill, number> = {
  READING: 3600,
  LISTENING: 0,
  WRITING: 3600,
  SPEAKING: 14 * 60,
};
/** Computer-delivered Listening gives a short review period after the audio. [kiểm nguồn chính thức ở P3] */
const LISTENING_REVIEW_SEC = 120;

type Tx = Prisma.TransactionClient;

/** Parse + semantic checks. Returns the parsed doc or throws IMPORT_INVALID with path-precise issues. */
export function parseTestImport(input: unknown, opts: { requirePublishable: boolean }): TestImportDoc {
  const parsed = TestImportDoc.safeParse(input);
  if (!parsed.success)
    throw new AppError('IMPORT_INVALID', 'File đề không hợp lệ', { issues: zodIssues(parsed.error) });
  const issues = [
    ...semanticIssues(parsed.data),
    ...(opts.requirePublishable ? checkPublishable(parsed.data) : []),
  ];
  if (issues.length > 0) throw new AppError('IMPORT_INVALID', 'File đề không hợp lệ', { issues });
  return parsed.data;
}

function groupWordLimit(g: ImportGroup): WordLimit | undefined {
  return 'wordLimit' in g ? g.wordLimit : undefined;
}

function isTextAnswer(g: ImportGroup): boolean {
  switch (g.type) {
    case 'SENTENCE_COMPLETION':
    case 'SHORT_ANSWER':
      return true;
    case 'SUMMARY_COMPLETION':
    case 'NOTE_TABLE_FLOWCHART_COMPLETION':
      return g.answerMode === 'WORDS';
    case 'MAP_DIAGRAM_LABELLING':
      return g.answerMode === 'WORDS';
    default:
      return false;
  }
}

/** The free-text answer fields of a question, if it has them. */
function textAnswerOf(q: object): { answer: string; accepted: string[] } | null {
  if (!('answer' in q) || typeof q.answer !== 'string' || !('accepted' in q) || !Array.isArray(q.accepted))
    return null;
  return { answer: q.answer, accepted: q.accepted.filter((a): a is string => typeof a === 'string') };
}

function acceptedVariants(answer: string, accepted: string[]): string[] {
  const all = [answer, ...accepted].flatMap(expandOptionalParts);
  const seen = new Set<string>();
  return all.filter((a) => {
    const k = normalizeForCompare(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Checks that need answer-text rules (word limits, optional parts). */
function semanticIssues(doc: TestImportDoc): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const visit = (groups: ImportGroup[], base: string) =>
    groups.forEach((g, gi) => {
      if (!isTextAnswer(g)) return;
      const limit = groupWordLimit(g);
      g.questions.forEach((q, qi) => {
        const text = textAnswerOf(q);
        if (!text) return;
        const path = `${base}.groups[${gi}].questions[${qi}]`;
        let variants: string[];
        try {
          variants = acceptedVariants(text.answer, text.accepted);
        } catch (err) {
          issues.push({ path: `${path}.answer`, code: 'invalid_answer', message: (err as Error).message });
          return;
        }
        if (limit) {
          for (const v of variants) {
            if (!fitsWordLimit(v, limit)) {
              issues.push({
                path: `${path}.accepted`,
                code: 'word_limit',
                message: `"${v}" vượt giới hạn ${limit.maxWords} từ`,
              });
            }
          }
        }
      });
    });
  doc.reading?.passages.forEach((p, i) => visit(p.groups, `reading.passages[${i}]`));
  doc.listening?.parts.forEach((p, i) => visit(p.groups, `listening.parts[${i}]`));
  return issues;
}

function correctAnswerOf(g: ImportGroup, q: ImportGroup['questions'][number]): CorrectAnswer {
  if (g.type === 'MULTIPLE_CHOICE_MULTI') return { kind: 'KEYS', keys: [...g.answer].sort() };
  if (!('answer' in q)) throw new Error('unreachable: question without answer');
  if (isTextAnswer(g)) return { kind: 'TEXT', display: q.answer };
  return { kind: 'KEY', key: g.type === 'MATCHING_HEADINGS' ? q.answer : q.answer.toUpperCase() };
}

/** Group → QuestionGroup.config (everything except columns, questions, answers and file refs). */
function configOf(g: ImportGroup): Prisma.InputJsonValue {
  const { instructions: _i, questionFrom: _f, questionTo: _t, questions: _q, ...rest } = g;
  const cfg: Record<string, unknown> = { ...rest };
  delete cfg.answer; // MC_MULTI answer lives on each question
  delete cfg.image; // → QuestionGroup.imageId
  return cfg as Prisma.InputJsonValue;
}

function contentOf(g: ImportGroup, q: ImportGroup['questions'][number]): Prisma.InputJsonValue {
  if (g.type === 'MULTIPLE_CHOICE_SINGLE' && 'options' in q) return { options: q.options };
  if (g.type === 'MATCHING_HEADINGS' && 'paragraphLabel' in q) return { paragraphLabel: q.paragraphLabel };
  if (g.type === 'MAP_DIAGRAM_LABELLING' && 'pin' in q && q.pin) return { pin: q.pin };
  return {};
}

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

interface ParagraphRef {
  id: string;
  label: string | null;
  text: string;
}

function resolveEvidence(
  ev: { paragraphLabel?: string | undefined; quote: string } | undefined,
  paragraphs: ParagraphRef[],
) {
  if (!ev) return undefined;
  const quote = normalizeText(ev.quote);
  const candidates = ev.paragraphLabel ? paragraphs.filter((p) => p.label === ev.paragraphLabel) : paragraphs;
  for (const p of candidates) {
    const start = p.text.indexOf(quote);
    if (start >= 0) return { paragraphId: p.id, start, end: start + quote.length, exact: quote };
  }
  return null;
}

async function createGroups(
  tx: Tx,
  ctx: {
    sectionId: string;
    partId: string;
    paragraphs: ParagraphRef[];
    resolveFile: FileResolver;
    base: string;
  },
  groups: ImportGroup[],
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  for (const [gi, g] of groups.entries()) {
    const imageRef = 'image' in g ? g.image : undefined;
    const imageId = imageRef
      ? await ctx.resolveFile(imageRef, 'TEST_IMAGE', `${ctx.base}.groups[${gi}].image`)
      : null;
    const limit = groupWordLimit(g);
    const questions: Prisma.QuestionUncheckedCreateWithoutGroupInput[] = [];
    for (const [qi, q] of g.questions.entries()) {
      const evidence = resolveEvidence(q.evidence, ctx.paragraphs);
      if (evidence === null) {
        issues.push({
          path: `${ctx.base}.groups[${gi}].questions[${qi}].evidence`,
          code: 'evidence_not_found',
          message: 'Không tìm thấy đoạn trích trong bài đọc',
        });
      }
      const text = isTextAnswer(g) ? textAnswerOf(q) : null;
      questions.push({
        sectionId: ctx.sectionId,
        number: q.number,
        prompt: 'prompt' in q && typeof q.prompt === 'string' ? q.prompt : null,
        content: contentOf(g, q),
        correctAnswer: correctAnswerOf(g, q),
        acceptedAnswers: text ? acceptedVariants(text.answer, text.accepted) : [],
        wordLimit: limit?.maxWords ?? null,
        explanation: q.explanation ?? null,
        ...(evidence ? { evidence } : {}),
      });
    }
    await tx.questionGroup.create({
      data: {
        partId: ctx.partId,
        order: gi,
        type: g.type,
        instructions: g.instructions,
        questionFrom: g.questionFrom,
        questionTo: g.questionTo,
        config: configOf(g),
        imageId,
        questions: { create: questions },
      },
    });
  }
  return issues;
}

export interface ImportOptions {
  status: Extract<TestStatus, 'DRAFT' | 'PUBLISHED'>;
  resolveFile: FileResolver;
  createdById?: string | null;
  version?: number;
}

/** Creates one Test version from a validated doc inside a single transaction. */
export async function importTest(doc: TestImportDoc, opts: ImportOptions): Promise<{ testId: string }> {
  const now = new Date();
  const contentHash = createHash('sha256').update(stableStringify(doc)).digest('hex');

  return prisma.$transaction(
    async (tx) => {
      const test = await tx.test.create({
        data: {
          seriesKey: doc.seriesKey,
          version: opts.version ?? 1,
          status: opts.status,
          publishedSeriesKey: opts.status === 'PUBLISHED' ? doc.seriesKey : null,
          publishedAt: opts.status === 'PUBLISHED' ? now : null,
          source: doc.source,
          type: doc.type,
          title: doc.title,
          sourceRef: doc.sourceRef ?? null,
          bookNumber: doc.bookNumber ?? null,
          testNumber: doc.testNumber ?? null,
          description: doc.description ?? null,
          contentHash,
          createdById: opts.createdById ?? null,
          publishedById: opts.status === 'PUBLISHED' ? (opts.createdById ?? null) : null,
        },
      });
      const issues: ValidationIssue[] = [];

      if (doc.reading) {
        const section = await tx.section.create({
          data: { testId: test.id, skill: 'READING', durationSec: DEFAULT_SECTION_SECONDS.READING },
        });
        for (const [pi, p] of doc.reading.passages.entries()) {
          const base = `reading.passages[${pi}]`;
          const suggested = p.suggestedMinutes ?? 20;
          const part = await tx.part.create({
            data: {
              sectionId: section.id,
              number: pi + 1,
              title: p.title,
              instructions: p.instructions ?? null,
              suggestedMinutes: suggested,
              durationSec: suggested * 60,
            },
          });
          const passage = await tx.passage.create({
            data: { partId: part.id, title: p.title, subtitle: p.subtitle ?? null },
          });
          const paragraphs: ParagraphRef[] = [];
          for (const [oi, para] of p.paragraphs.entries()) {
            const imageId = para.image
              ? await opts.resolveFile(para.image, 'TEST_IMAGE', `${base}.paragraphs[${oi}].image`)
              : null;
            const row = await tx.paragraph.create({
              data: {
                passageId: passage.id,
                order: oi,
                label: para.label ?? null,
                kind: para.kind,
                text: para.text,
                imageId,
              },
            });
            paragraphs.push({ id: row.id, label: row.label, text: row.text });
          }
          issues.push(
            ...(await createGroups(
              tx,
              { sectionId: section.id, partId: part.id, paragraphs, resolveFile: opts.resolveFile, base },
              p.groups,
            )),
          );
        }
      }

      if (doc.listening) {
        const audioTotalMs = doc.listening.parts.reduce((s, p) => s + p.audio.durationMs, 0);
        const section = await tx.section.create({
          data: {
            testId: test.id,
            skill: 'LISTENING',
            durationSec: Math.ceil(audioTotalMs / 1000) + LISTENING_REVIEW_SEC,
          },
        });
        for (const [pi, p] of doc.listening.parts.entries()) {
          const base = `listening.parts[${pi}]`;
          const part = await tx.part.create({
            data: {
              sectionId: section.id,
              number: pi + 1,
              title: p.title ?? `Part ${pi + 1}`,
              instructions: p.instructions ?? null,
            },
          });
          const fileId = await opts.resolveFile(p.audio.file, 'TEST_AUDIO', `${base}.audio.file`);
          await tx.audio.create({
            data: {
              partId: part.id,
              fileId,
              durationMs: p.audio.durationMs,
              startMs: p.audio.startMs ?? null,
              endMs: p.audio.endMs ?? null,
              transcript: p.audio.transcript ?? null,
            },
          });
          issues.push(
            ...(await createGroups(
              tx,
              { sectionId: section.id, partId: part.id, paragraphs: [], resolveFile: opts.resolveFile, base },
              p.groups,
            )),
          );
        }
      }

      if (doc.writing) {
        const section = await tx.section.create({
          data: { testId: test.id, skill: 'WRITING', durationSec: DEFAULT_SECTION_SECONDS.WRITING },
        });
        for (const [ti, t] of doc.writing.tasks.entries()) {
          const part = await tx.part.create({
            data: {
              sectionId: section.id,
              number: t.task,
              title: `Task ${t.task}`,
              suggestedMinutes: t.suggestedMinutes,
              durationSec: t.suggestedMinutes * 60,
            },
          });
          const imageId = t.image
            ? await opts.resolveFile(t.image, 'TEST_IMAGE', `writing.tasks[${ti}].image`)
            : null;
          await tx.writingTask.create({
            data: {
              partId: part.id,
              kind: t.kind,
              prompt: t.prompt,
              imageId,
              visual: t.visual ?? null,
              minWords: t.minWords,
            },
          });
        }
      }

      if (doc.speaking) {
        const section = await tx.section.create({
          data: { testId: test.id, skill: 'SPEAKING', durationSec: DEFAULT_SECTION_SECONDS.SPEAKING },
        });
        for (const p of doc.speaking.parts) {
          const part = await tx.part.create({
            data: { sectionId: section.id, number: p.part, title: `Part ${p.part}` },
          });
          await tx.speakingPart.create({
            data:
              p.part === 2
                ? {
                    partId: part.id,
                    cueCard: p.cueCard,
                    questions: p.followUps,
                    prepSeconds: p.prepSeconds,
                    speakSeconds: p.speakSeconds,
                  }
                : { partId: part.id, topic: p.topic ?? null, questions: p.questions },
          });
        }
      }

      if (issues.length > 0) throw new AppError('IMPORT_INVALID', 'File đề không hợp lệ', { issues });
      return { testId: test.id };
    },
    { timeout: 60_000 },
  );
}
