// Loose read/write of a TestImportDoc for the admin answer editor. Drafts may be invalid, so reading never
// throws: missing pieces become empty values. Every view carries the JSON path it was read from.
import { TFNG_KEYS, YNNG_KEYS } from '@/shared/question-types';

export type DocPath = (string | number)[];
export interface Choice {
  key: string;
  text: string;
}
export interface AnswerQuestionView {
  path: DocPath;
  number: number;
  label: string;
  answer: string;
  accepted: string[];
  explanation: string;
  /** MC single only: this question's own options. */
  choices?: Choice[];
}
export interface AnswerGroupView {
  path: DocPath;
  type: string;
  from: number;
  to: number;
  instructions: string;
  /** null = free text answer. */
  choices: Choice[] | null;
  perQuestionChoices: boolean;
  /** MC multi only: the answer lives on the group. */
  multi: { chooseCount: number; answer: string[] } | null;
  questions: AnswerQuestionView[];
}
export interface AnswerPart {
  skill: 'READING' | 'LISTENING';
  index: number;
  title: string;
  paragraphs: { label: string | null; text: string }[];
  transcript: string | null;
  groups: AnswerGroupView[];
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

const options = (v: unknown): Choice[] =>
  arr(v).map((o) => ({ key: str(obj(o).key), text: str(obj(o).text) }));
const judgement = (keys: readonly string[]): Choice[] =>
  keys.map((key) => ({ key, text: key.replace(/_/g, ' ') }));

function groupChoices(g: Obj): Choice[] | null {
  switch (g.type) {
    case 'MULTIPLE_CHOICE_MULTI':
      return options(g.options);
    case 'TRUE_FALSE_NOT_GIVEN':
      return judgement(TFNG_KEYS);
    case 'YES_NO_NOT_GIVEN':
      return judgement(YNNG_KEYS);
    case 'MATCHING_HEADINGS': {
      const example = str(obj(g.example).headingKey);
      return options(g.headings).filter((h) => h.key !== example);
    }
    case 'MATCHING_INFORMATION':
      return arr(g.paragraphLabels).map((k) => ({ key: str(k), text: str(k) }));
    case 'MATCHING_FEATURES':
      return options(g.features);
    case 'SUMMARY_COMPLETION':
    case 'NOTE_TABLE_FLOWCHART_COMPLETION':
      return g.answerMode === 'WORD_BANK' ? options(obj(g.wordBank).options) : null;
    case 'MAP_DIAGRAM_LABELLING':
      return g.answerMode === 'OPTIONS' ? options(g.options) : null;
    default:
      return null;
  }
}

function readGroup(g: Obj, path: DocPath): AnswerGroupView {
  const perQuestionChoices = g.type === 'MULTIPLE_CHOICE_SINGLE';
  return {
    path,
    type: str(g.type),
    from: num(g.questionFrom),
    to: num(g.questionTo),
    instructions: str(g.instructions),
    choices: perQuestionChoices ? null : groupChoices(g),
    perQuestionChoices,
    multi:
      g.type === 'MULTIPLE_CHOICE_MULTI'
        ? { chooseCount: num(g.chooseCount), answer: arr(g.answer).map(str) }
        : null,
    questions: arr(g.questions).map((raw, qi) => {
      const q = obj(raw);
      const prompt = str(q.prompt);
      return {
        path: [...path, 'questions', qi],
        number: num(q.number),
        label:
          g.type === 'MATCHING_HEADINGS'
            ? `Đoạn ${str(q.paragraphLabel)}`
            : prompt.length > 80
              ? `${prompt.slice(0, 80)}…`
              : prompt,
        answer: str(q.answer),
        accepted: arr(q.accepted).map(str),
        explanation: str(q.explanation),
        ...(perQuestionChoices ? { choices: options(q.options) } : {}),
      };
    }),
  };
}

export function answerParts(doc: unknown): AnswerPart[] {
  const d = obj(doc);
  const reading = arr(obj(d.reading).passages).map((raw, index): AnswerPart => {
    const p = obj(raw);
    const base: DocPath = ['reading', 'passages', index];
    return {
      skill: 'READING',
      index,
      title: str(p.title),
      paragraphs: arr(p.paragraphs).map((para) => ({
        label: str(obj(para).label) || null,
        text: str(obj(para).text),
      })),
      transcript: null,
      groups: arr(p.groups).map((g, gi) => readGroup(obj(g), [...base, 'groups', gi])),
    };
  });
  const listening = arr(obj(d.listening).parts).map((raw, index): AnswerPart => {
    const p = obj(raw);
    const base: DocPath = ['listening', 'parts', index];
    return {
      skill: 'LISTENING',
      index,
      title: str(p.title),
      paragraphs: [],
      transcript: str(obj(p.audio).transcript) || null,
      groups: arr(p.groups).map((g, gi) => readGroup(obj(g), [...base, 'groups', gi])),
    };
  });
  return [...reading, ...listening];
}

/** Immutable update; `undefined` removes the key. Containers along the path are copied, siblings are shared. */
export function setAt(doc: unknown, path: DocPath, value: unknown): unknown {
  const [head, ...rest] = path;
  if (head === undefined) return value;
  if (typeof head === 'number') {
    const copy = [...arr(doc)];
    copy[head] = setAt(copy[head], rest, value);
    return copy;
  }
  const copy: Obj = { ...obj(doc) };
  const next = rest.length ? setAt(copy[head], rest, value) : value;
  if (next === undefined) delete copy[head];
  else copy[head] = next;
  return copy;
}

/** One variant per line: trimmed, blanks dropped. */
export const toLines = (s: string): string[] =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Textarea state for a one-per-line list. `key` is the last value seen from outside. Returns the next state when
 * the value changed from outside (keeping the typed text if it already means the same list), else null.
 */
export function syncLines(
  state: { key: string; text: string },
  value: string[],
): { key: string; text: string } | null {
  const key = value.join('\n');
  if (key === state.key) return null;
  const same = toLines(state.text).join('\n') === toLines(key).join('\n');
  return { key, text: same ? state.text : key };
}
