// Automatic question numbering for the builder.
// IELTS numbers questions 1–40 continuously across the passages (Reading) / parts (Listening). The builder never
// asks the author for numbers: after every edit the whole section is renumbered in reading order, and blank
// markers {{n}} inside completion texts are rewritten to match.
//
// Blank-driven groups (SUMMARY / NOTE_TABLE_FLOWCHART): the questions ARE the blanks. Each {{n}} in reading order
// becomes one question; an existing question keeps its answer when its old number is still referenced, a new
// marker (e.g. the inserted {{0}}) creates an empty question.
import { BLANK_RE } from '@/shared/primitives';
import type { Doc, Group, GroupOf } from './types';

type Q = Group['questions'][number];
type BlankGroup = GroupOf<'SUMMARY_COMPLETION'> | GroupOf<'NOTE_TABLE_FLOWCHART_COMPLETION'>;

const emptyTextQuestion = (number: number) => ({ number, answer: '', accepted: [] as string[] });

/** Replace the i-th blank occurrence with `next(oldNumber)` across the given strings (reading order). */
function mapBlanks(texts: string[], next: (old: number) => number): string[] {
  return texts.map((t) => t.replace(BLANK_RE, (_m, n: string) => `{{${next(Number(n))}}}`));
}

/** All template strings of a blank-driven group, in reading order, plus a writer to put them back. */
function blankTexts(g: BlankGroup): { texts: string[]; write: (texts: string[]) => void } {
  if (g.type === 'SUMMARY_COMPLETION') {
    return { texts: [g.text], write: ([t]) => (g.text = t ?? '') };
  }
  const tpl = g.template;
  if (tpl.layout === 'NOTES') {
    return {
      texts: tpl.lines.map((l) => l.text),
      write: (ts) => tpl.lines.forEach((l, i) => (l.text = ts[i] ?? '')),
    };
  }
  if (tpl.layout === 'TABLE') {
    const cells = tpl.rows.flatMap((r) => r.cells);
    return {
      texts: cells,
      write: (ts) => {
        let k = 0;
        for (const r of tpl.rows) r.cells = r.cells.map(() => ts[k++] ?? '');
      },
    };
  }
  return {
    texts: tpl.steps.map((s) => s.text),
    write: (ts) => tpl.steps.forEach((s, i) => (s.text = ts[i] ?? '')),
  };
}

export function isBlankDriven(g: Group): g is BlankGroup {
  return g.type === 'SUMMARY_COMPLETION' || g.type === 'NOTE_TABLE_FLOWCHART_COMPLETION';
}

/** Numbers referenced by blanks of a blank-driven group, in reading order. */
export function blanksInOrder(g: BlankGroup): number[] {
  return blankTexts(g).texts.flatMap((t) => [...t.matchAll(BLANK_RE)].map((m) => Number(m[1])));
}

/** Renumber one group starting at `from` (mutates). Returns the next free number. */
export function renumberGroup(g: Group, from: number): number {
  if (isBlankDriven(g)) {
    const { texts, write } = blankTexts(g);
    const byOld = new Map<number, Q>();
    for (const q of g.questions) if (!byOld.has(q.number)) byOld.set(q.number, q);
    const questions: Q[] = [];
    let k = from;
    const rewritten = mapBlanks(texts, (old) => {
      const prev = byOld.get(old);
      byOld.delete(old); // one question per blank, a repeated number becomes a new question
      questions.push({ ...(prev ?? emptyTextQuestion(k)), number: k } as Q);
      return k++;
    });
    write(rewritten);
    (g as { questions: Q[] }).questions = questions;
  } else {
    g.questions.forEach((q, i) => {
      q.number = from + i;
      if (g.type === 'SENTENCE_COMPLETION' && 'prompt' in q && typeof q.prompt === 'string') {
        q.prompt = q.prompt.replace(BLANK_RE, `{{${from + i}}}`);
      }
    });
  }
  const count = g.questions.length;
  g.questionFrom = from;
  g.questionTo = count > 0 ? from + count - 1 : from;
  return from + count;
}

/** Renumber every Reading and Listening group of the doc (mutates). */
export function renumberDoc(doc: Doc): void {
  for (const sections of [doc.reading?.passages, doc.listening?.parts]) {
    if (!sections) continue;
    let n = 1;
    for (const s of sections) for (const g of s.groups) n = renumberGroup(g, n);
  }
}

/** Total questions of a skill section. */
export function questionCount(sections: { groups: Group[] }[] | undefined): number {
  return (sections ?? []).reduce((sum, s) => sum + s.groups.reduce((a, g) => a + g.questions.length, 0), 0);
}
