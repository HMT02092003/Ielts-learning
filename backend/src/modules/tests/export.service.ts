// DB → TestImportDoc (the reverse of import.service). Used by the admin JSON editor, clone and publish checks.
// Files are referenced by { fileId } so a re-import re-uses the stored media.
import { prisma } from '../../config/prisma';
import { notFound } from '../../lib/errors';
import { CorrectAnswer, QuestionGroupConfig } from '../../shared/question-types';
import type { TestImportDoc } from '../../shared/test-import';

/** Drop null/undefined so the strict import schemas accept the object. */
function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

/** Question types whose import schema has a `prompt` field. */
const HAS_PROMPT = new Set([
  'MULTIPLE_CHOICE_SINGLE',
  'TRUE_FALSE_NOT_GIVEN',
  'YES_NO_NOT_GIVEN',
  'MATCHING_INFORMATION',
  'MATCHING_FEATURES',
  'SENTENCE_COMPLETION',
  'SHORT_ANSWER',
  'MAP_DIAGRAM_LABELLING',
]);

const testInclude = {
  sections: {
    orderBy: { skill: 'asc' },
    include: {
      parts: {
        orderBy: { number: 'asc' },
        include: {
          passage: { include: { paragraphs: { orderBy: { order: 'asc' } } } },
          audio: true,
          writingTask: true,
          speakingPart: true,
          groups: {
            orderBy: { order: 'asc' },
            include: { questions: { orderBy: { number: 'asc' } } },
          },
        },
      },
    },
  },
} as const;

type GroupRow = {
  type: string;
  instructions: string;
  questionFrom: number;
  questionTo: number;
  config: unknown;
  imageId: string | null;
  questions: {
    number: number;
    prompt: string | null;
    content: unknown;
    correctAnswer: unknown;
    acceptedAnswers: string[];
    explanation: string | null;
    evidence: unknown;
  }[];
};

function exportGroup(g: GroupRow, paragraphs: { id: string; label: string | null }[]) {
  const config = QuestionGroupConfig.parse(g.config);
  const { type: _type, ...configRest } = config;
  const questions = g.questions.map((q) => {
    const correct = CorrectAnswer.parse(q.correctAnswer);
    const content = typeof q.content === 'object' && q.content !== null ? q.content : {};
    const ev = q.evidence as { paragraphId?: string; exact?: string } | null;
    const evidence = ev?.exact
      ? compact({
          paragraphLabel: paragraphs.find((p) => p.id === ev.paragraphId)?.label ?? undefined,
          quote: ev.exact,
        })
      : undefined;
    const base = compact({
      number: q.number,
      prompt: HAS_PROMPT.has(g.type) ? q.prompt : undefined,
      explanation: q.explanation,
      evidence,
      ...content,
    });
    if (correct.kind === 'KEYS') return base; // MC_MULTI: answer lives on the group
    if (correct.kind === 'TEXT') return { ...base, answer: correct.display, accepted: q.acceptedAnswers };
    return { ...base, answer: correct.key };
  });
  const firstCorrect = g.questions[0] ? CorrectAnswer.parse(g.questions[0].correctAnswer) : null;
  return compact({
    type: g.type,
    instructions: g.instructions,
    questionFrom: g.questionFrom,
    questionTo: g.questionTo,
    ...configRest,
    answer: firstCorrect?.kind === 'KEYS' ? firstCorrect.keys : undefined,
    image: g.imageId ? { fileId: g.imageId } : undefined,
    questions,
  });
}

/** Returns an (unvalidated) import document; callers run it through parseTestImport. */
export async function exportTest(testId: string): Promise<TestImportDoc> {
  const t = await prisma.test.findUnique({ where: { id: testId }, include: testInclude });
  if (!t) throw notFound('Đề');
  const section = (skill: string) => t.sections.find((s) => s.skill === skill);
  const reading = section('READING');
  const listening = section('LISTENING');
  const writing = section('WRITING');
  const speaking = section('SPEAKING');

  const doc = compact({
    schemaVersion: 1,
    seriesKey: t.seriesKey,
    source: t.source,
    type: t.type,
    title: t.title,
    sourceRef: t.sourceRef,
    bookNumber: t.bookNumber,
    testNumber: t.testNumber,
    description: t.description,
    reading: reading && {
      passages: reading.parts.map((p) => {
        const paragraphs = p.passage?.paragraphs ?? [];
        return compact({
          title: p.passage?.title ?? p.title ?? `Passage ${p.number}`,
          subtitle: p.passage?.subtitle,
          instructions: p.instructions,
          suggestedMinutes: p.suggestedMinutes,
          paragraphs: paragraphs.map((para) =>
            compact({
              label: para.label,
              kind: para.kind,
              text: para.text,
              image: para.imageId ? { fileId: para.imageId } : undefined,
            }),
          ),
          groups: p.groups.map((g) => exportGroup(g, paragraphs)),
        });
      }),
    },
    listening: listening && {
      parts: listening.parts.map((p) =>
        compact({
          title: p.title,
          instructions: p.instructions,
          audio: p.audio
            ? compact({
                file: { fileId: p.audio.fileId },
                durationMs: p.audio.durationMs,
                startMs: p.audio.startMs,
                endMs: p.audio.endMs,
                transcript: p.audio.transcript,
              })
            : undefined,
          groups: p.groups.map((g) => exportGroup(g, [])),
        }),
      ),
    },
    writing: writing && {
      tasks: writing.parts.flatMap((p) =>
        p.writingTask
          ? [
              compact({
                task: p.number,
                kind: p.writingTask.kind,
                prompt: p.writingTask.prompt,
                image: p.writingTask.imageId ? { fileId: p.writingTask.imageId } : undefined,
                visual: p.writingTask.visual,
                minWords: p.writingTask.minWords,
                suggestedMinutes: p.suggestedMinutes ?? (p.number === 1 ? 20 : 40),
              }),
            ]
          : [],
      ),
    },
    speaking: speaking && {
      parts: speaking.parts.flatMap((p) => {
        const sp = p.speakingPart;
        if (!sp) return [];
        if (p.number === 2) {
          return [
            {
              part: 2,
              cueCard: sp.cueCard,
              prepSeconds: sp.prepSeconds,
              speakSeconds: sp.speakSeconds ?? 120,
              followUps: sp.questions,
            },
          ];
        }
        return [compact({ part: p.number, topic: sp.topic, questions: sp.questions })];
      }),
    },
  });
  return doc as unknown as TestImportDoc;
}
