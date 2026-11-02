// Editing types for the test builder: the *input* side of the TestImportDoc schema (defaults optional),
// so a half-written test is still representable. Validation always runs the real Zod schema.
import type { z } from 'zod';
import type {
  FileRef,
  ImportGroup,
  ImportListeningPart,
  ImportParagraph,
  ImportPassage,
  ImportSpeakingPart,
  ImportWritingTask,
  TestImportDoc,
} from '@/shared/test-import';
import type { QuestionType } from '@/shared/enums';

export type Doc = z.input<typeof TestImportDoc>;
export type Group = z.input<typeof ImportGroup>;
export type GroupOf<T extends QuestionType> = Extract<Group, { type: T }>;
export type Passage = z.input<typeof ImportPassage>;
export type Paragraph = z.input<typeof ImportParagraph>;
export type ListeningPart = z.input<typeof ImportListeningPart>;
export type WritingTask = z.input<typeof ImportWritingTask>;
export type SpeakingPart = z.input<typeof ImportSpeakingPart>;
export type FileRefIn = z.input<typeof FileRef>;
export type QSkill = 'reading' | 'listening';

/** What the middle column is editing. */
export type Selection =
  | { kind: 'meta' }
  | { kind: 'passage'; i: number }
  | { kind: 'lpart'; i: number }
  | { kind: 'group'; skill: QSkill; i: number; g: number }
  | { kind: 'writing'; i: number }
  | { kind: 'speaking'; i: number };

/** Issue path prefix (formatIssuePath style) owned by a selection. */
export function selectionPath(s: Selection): string {
  switch (s.kind) {
    case 'meta':
      return '';
    case 'passage':
      return `reading.passages[${s.i}]`;
    case 'lpart':
      return `listening.parts[${s.i}]`;
    case 'group':
      return `${s.skill === 'reading' ? 'reading.passages' : 'listening.parts'}[${s.i}].groups[${s.g}]`;
    case 'writing':
      return `writing.tasks[${s.i}]`;
    case 'speaking':
      return `speaking.parts[${s.i}]`;
  }
}

export const sameSelection = (a: Selection, b: Selection) =>
  selectionPath(a) === selectionPath(b) && a.kind === b.kind;

/** Sections (passages / parts) that hold question groups. */
export function sectionsOf(doc: Doc, skill: QSkill): { groups: Group[] }[] {
  return skill === 'reading' ? (doc.reading?.passages ?? []) : (doc.listening?.parts ?? []);
}
