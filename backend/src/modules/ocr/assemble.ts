// Turn reviewed OCR blocks into a draft TestImportDoc. This is a best-effort heuristic: the admin always
// finishes the result in the JSON editor (errors are shown with their path) before publishing.
import type { AssembleMeta, ReviewBlock } from '../../shared/ocr';

type Json = Record<string, unknown>;

const QUESTIONS_RE = /questions?\s+(\d{1,2})\s*(?:[-–—]|to|and)\s*(\d{1,2})/i;
const NUMBERED_RE = /^\s*(\d{1,2})[.)]?\s+(.+)$/;
const OPTION_RE = /^\s*([A-H])[.)]?\s+(.+)$/;
const LABELLED_PARAGRAPH_RE = /^([A-Z])\s{1,3}(\S.+)$/s;
const WORD_LIMIT_RE = /NO MORE THAN (ONE|TWO|THREE|FOUR|FIVE) WORDS?( AND\/OR A NUMBER)?|ONE WORD ONLY/i;
const WORDS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** Guess the question type from the instruction wording (Cambridge-style phrasing). */
export function guessType(instructions: string): string {
  const t = instructions.toUpperCase();
  if (t.includes('TRUE') && t.includes('NOT GIVEN')) return 'TRUE_FALSE_NOT_GIVEN';
  if (t.includes('YES') && t.includes('NOT GIVEN')) return 'YES_NO_NOT_GIVEN';
  if (t.includes('LIST OF HEADINGS') || t.includes('CORRECT HEADING')) return 'MATCHING_HEADINGS';
  if (/WHICH (SECTION|PARAGRAPH) CONTAINS/.test(t)) return 'MATCHING_INFORMATION';
  if (/CHOOSE (TWO|THREE) LETTERS/.test(t)) return 'MULTIPLE_CHOICE_MULTI';
  if (t.includes('CHOOSE THE CORRECT LETTER')) return 'MULTIPLE_CHOICE_SINGLE';
  if (t.includes('SUMMARY')) return 'SUMMARY_COMPLETION';
  if (/NOTES|TABLE|FLOW-?CHART/.test(t)) return 'NOTE_TABLE_FLOWCHART_COMPLETION';
  if (t.includes('COMPLETE THE SENTENCES')) return 'SENTENCE_COMPLETION';
  if (t.includes('MATCH')) return 'MATCHING_FEATURES';
  return 'SHORT_ANSWER';
}

function wordLimitOf(instructions: string) {
  const m = WORD_LIMIT_RE.exec(instructions);
  if (!m) return { maxWords: 2, allowNumber: false };
  if (!m[1]) return { maxWords: 1, allowNumber: false };
  return { maxWords: WORDS[m[1].toUpperCase()] ?? 2, allowNumber: Boolean(m[2]) };
}

/**
 * Auto-tag raw OCR blocks (the admin corrects tags in the review screen). Context matters: "A ..." is an answer
 * option only right after a question/option block; otherwise it is a lettered passage paragraph.
 */
export function guessTags(texts: string[]): ReviewBlock['tag'][] {
  const tags: ReviewBlock['tag'][] = [];
  for (const raw of texts) {
    const t = raw.trim();
    const prev = tags.at(-1);
    let tag: ReviewBlock['tag'] = 'PASSAGE';
    if (QUESTIONS_RE.test(t.split('\n')[0] ?? '')) tag = 'INSTRUCTION';
    else if (/^(answer key|answers)\b/i.test(t)) tag = 'ANSWER';
    else if (NUMBERED_RE.test(t) && t.length < 400) tag = 'QUESTION';
    else if (OPTION_RE.test(t) && t.length < 300 && (prev === 'QUESTION' || prev === 'OPTION'))
      tag = 'OPTION';
    tags.push(tag);
  }
  return tags;
}

export function assembleDoc(
  blocks: ReviewBlock[],
  answerKey: Record<string, string[]>,
  meta: AssembleMeta,
): Json {
  const passages: Json[] = [];
  // Held in an object so TypeScript does not narrow it across the closure below.
  const cur: { passage: { title: string; paragraphs: Json[]; groups: Json[] } | null } = { passage: null };
  let group: (Json & { questions: Json[] }) | null = null;
  let lastQuestion: Json | null = null;
  let expectTitle = true;

  const ensurePassage = () => {
    if (!cur.passage) {
      cur.passage = { title: `Passage ${passages.length + 1}`, paragraphs: [], groups: [] };
      passages.push(cur.passage);
    }
    return cur.passage;
  };

  /** Key-type answers (TFNG, letters…) take one value; only typed-text answers carry `accepted` variants. */
  const answerFor = (n: number, textAnswer: boolean) => {
    const list = answerKey[String(n)] ?? [];
    return textAnswer ? { answer: list[0] ?? '', accepted: list.slice(1) } : { answer: list[0] ?? '' };
  };

  for (const b of blocks) {
    const text = b.text.trim();
    if (!text || b.tag === 'IGNORE' || b.tag === 'ANSWER') continue;
    if (b.tag === 'PASSAGE') {
      // A passage starts again after its questions: a short line without a final period becomes the title.
      if (cur.passage && cur.passage.groups.length > 0) {
        cur.passage = null;
        expectTitle = true;
      }
      const p = ensurePassage();
      if (expectTitle && text.length <= 100 && !/[.!?]$/.test(text) && !text.includes('\n')) {
        p.title = text;
        expectTitle = false;
        continue;
      }
      expectTitle = false;
      const m = LABELLED_PARAGRAPH_RE.exec(text);
      p.paragraphs.push(
        m ? { label: m[1], text: (m[2] ?? '').replace(/\s+/g, ' ') } : { text: text.replace(/\s+/g, ' ') },
      );
      continue;
    }
    if (b.tag === 'INSTRUCTION') {
      const m = QUESTIONS_RE.exec(text);
      const type = guessType(text);
      const from = m ? Number(m[1]) : 1;
      const to = m ? Number(m[2]) : from;
      group = {
        type,
        instructions: text.replace(/\s+/g, ' '),
        questionFrom: from,
        questionTo: to,
        questions: [],
      };
      if (
        [
          'SENTENCE_COMPLETION',
          'SHORT_ANSWER',
          'SUMMARY_COMPLETION',
          'NOTE_TABLE_FLOWCHART_COMPLETION',
        ].includes(type)
      ) {
        group.wordLimit = wordLimitOf(text);
      }
      if (type === 'SUMMARY_COMPLETION') {
        group.answerMode = 'WORDS';
        group.text = '';
      }
      ensurePassage().groups.push(group);
      lastQuestion = null;
      continue;
    }
    if (b.tag === 'QUESTION') {
      for (const line of text.split('\n')) {
        const m = NUMBERED_RE.exec(line);
        if (m && group) {
          const n = Number(m[1]);
          lastQuestion = { number: n, prompt: (m[2] ?? '').trim(), ...answerFor(n, 'wordLimit' in group) };
          if (group.type === 'MULTIPLE_CHOICE_SINGLE') lastQuestion.options = [];
          group.questions.push(lastQuestion);
        } else if (lastQuestion && typeof lastQuestion.prompt === 'string') {
          lastQuestion.prompt = `${lastQuestion.prompt} ${line.trim()}`;
        }
      }
      continue;
    }
    // Remaining tag: OPTION
    {
      for (const line of text.split('\n')) {
        const m = OPTION_RE.exec(line);
        if (!m) continue;
        const opt = { key: m[1], text: (m[2] ?? '').trim() };
        if (lastQuestion && Array.isArray(lastQuestion.options)) (lastQuestion.options as Json[]).push(opt);
        else if (group) {
          const key = group.type === 'MATCHING_HEADINGS' ? 'headings' : 'features';
          if (!Array.isArray(group[key])) group[key] = [];
          (group[key] as Json[]).push(opt);
        }
      }
    }
  }

  return {
    schemaVersion: 1,
    seriesKey: meta.seriesKey,
    source: meta.source,
    type: meta.type,
    title: meta.title,
    ...(meta.sourceRef ? { sourceRef: meta.sourceRef } : {}),
    reading: { passages },
  };
}
