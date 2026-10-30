// Loads the student-facing content of a test section, filtered to an attempt's scope. The Prisma `select` below is
// the ONLY way content leaves the server before submission: it never selects correctAnswer, acceptedAnswers,
// explanation, evidence or transcript.
import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { AppError, notFound } from '../../lib/errors';
import type { ContentPart } from '../../shared/attempt';
import { AttemptContentDto } from '../../shared/attempt';
import type { AttemptScope, QuestionType, Skill } from '../../shared/enums';
import { SpeakingCueCard } from '../../shared/test-import';

export const contentSelect = {
  id: true,
  skill: true,
  durationSec: true,
  test: { select: { id: true, title: true, source: true, type: true, status: true, bandTableId: true } },
  parts: {
    orderBy: { number: 'asc' },
    select: {
      id: true,
      number: true,
      title: true,
      instructions: true,
      suggestedMinutes: true,
      durationSec: true,
      passage: {
        select: {
          title: true,
          subtitle: true,
          paragraphs: {
            orderBy: { order: 'asc' },
            select: { id: true, label: true, kind: true, text: true, imageId: true },
          },
        },
      },
      audio: { select: { fileId: true, durationMs: true, startMs: true, endMs: true } },
      writingTask: { select: { kind: true, prompt: true, imageId: true, minWords: true } },
      speakingPart: {
        select: { topic: true, questions: true, cueCard: true, prepSeconds: true, speakSeconds: true },
      },
      groups: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          type: true,
          instructions: true,
          questionFrom: true,
          questionTo: true,
          config: true,
          imageId: true,
          questions: {
            orderBy: { number: 'asc' },
            select: { id: true, number: true, prompt: true, content: true },
          },
        },
      },
    },
  },
} as const satisfies Prisma.SectionSelect;

export type SectionContent = Prisma.SectionGetPayload<{ select: typeof contentSelect }>;

export interface Scope {
  scope: AttemptScope;
  partId: string | null;
  questionTypes: QuestionType[];
  questionNumbers: number[];
}

export async function loadSection(sectionId: string): Promise<SectionContent> {
  const s = await prisma.section.findUnique({ where: { id: sectionId }, select: contentSelect });
  if (!s) throw notFound('Phần thi');
  return s;
}

export async function loadSectionBySkill(testId: string, skill: Skill): Promise<SectionContent> {
  const s = await prisma.section.findFirst({ where: { testId, skill }, select: contentSelect });
  if (!s) throw notFound('Kỹ năng này trong đề');
  return s;
}

/** Keep only the parts / groups / questions in scope (passages stay whole: they are needed to answer). */
export function filterToScope(section: SectionContent, s: Scope): SectionContent['parts'] {
  let parts = section.parts;
  if (s.scope === 'PART') parts = parts.filter((p) => p.id === s.partId);
  if (s.scope === 'QUESTION_TYPE' || s.scope === 'QUESTION_IDS') {
    const keepQ = (n: number, type: QuestionType) =>
      s.scope === 'QUESTION_TYPE' ? s.questionTypes.includes(type) : s.questionNumbers.includes(n);
    parts = parts
      .map((p) => ({
        ...p,
        groups: p.groups
          .map((g) => ({ ...g, questions: g.questions.filter((q) => keepQ(q.number, g.type)) }))
          .filter((g) => g.questions.length > 0),
      }))
      .filter((p) => p.groups.length > 0);
  }
  if (parts.length === 0) throw new AppError('VALIDATION_ERROR', 'Phạm vi đã chọn không có câu hỏi nào');
  return parts;
}

export function scopedQuestionIds(parts: SectionContent['parts']): string[] {
  return parts.flatMap((p) => p.groups.flatMap((g) => g.questions.map((q) => q.id)));
}

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Map to the student DTO and parse it (fail-closed: unknown keys never reach the client). */
export function toContentDto(attemptId: string, section: SectionContent, parts: SectionContent['parts']) {
  const dtoParts: ContentPart[] = parts.map((p) => ({
    id: p.id,
    number: p.number,
    title: p.title,
    instructions: p.instructions,
    suggestedMinutes: p.suggestedMinutes,
    passage: p.passage,
    audio: p.audio,
    writingTask: p.writingTask,
    speakingPart: p.speakingPart
      ? { ...p.speakingPart, cueCard: SpeakingCueCard.nullable().catch(null).parse(p.speakingPart.cueCard) }
      : null,
    groups: p.groups.map((g) => ({
      ...g,
      config: asRecord(g.config),
      questions: g.questions.map((q) => ({ ...q, content: asRecord(q.content) })),
    })),
  }));
  return AttemptContentDto.parse({
    attemptId,
    test: {
      id: section.test.id,
      title: section.test.title,
      source: section.test.source,
      type: section.test.type,
    },
    skill: section.skill,
    parts: dtoParts,
  });
}
