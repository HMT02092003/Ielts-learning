// "Dán nhanh": turn text copied from a book / PDF into builder data. Pure functions, unit-tested.

const clean = (s: string) =>
  s
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

export interface PastedParagraph {
  label?: string;
  text: string;
}

/**
 * Passage text → paragraphs. Paragraphs are separated by blank lines (or by single newlines when the text has
 * no blank line). A leading "A ", "A.", "[A]" or "(A)" is taken as the paragraph label; otherwise labels are
 * assigned A, B, C… when `autoLabel` is set. Hard line breaks inside a paragraph (PDF copy) are joined.
 */
export function splitParagraphs(raw: string, autoLabel = true): PastedParagraph[] {
  const text = raw.replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const blocks = /\n\s*\n/.test(text) ? text.split(/\n\s*\n+/) : text.split('\n');
  const out: PastedParagraph[] = [];
  for (const block of blocks) {
    const joined = clean(block.replace(/-\n(?=\p{Ll})/gu, '').replace(/\n/g, ' '));
    if (!joined) continue;
    const m = /^(?:\[([A-Z])\]|\(([A-Z])\)|([A-Z])(?:[.:]\s*|\s+(?=[A-Z])))(.+)$/u.exec(joined);
    if (m) out.push({ label: m[1] ?? m[2] ?? m[3], text: clean(m[4] ?? '') });
    else out.push({ text: joined });
  }
  if (autoLabel && out.every((p) => !p.label)) out.forEach((p, i) => (p.label = String.fromCharCode(65 + i)));
  return out;
}

export interface PastedOption {
  key: string;
  text: string;
}

const ROMANS = [
  'i',
  'ii',
  'iii',
  'iv',
  'v',
  'vi',
  'vii',
  'viii',
  'ix',
  'x',
  'xi',
  'xii',
  'xiii',
  'xiv',
  'xv',
];
const romanAt = (i: number) => ROMANS[i] ?? String(i + 1);

/**
 * Option list → [{key,text}]. Accepts one option per line ("A. text", "A) text", "(A) text", "A text",
 * "iv. text") or several on one line ("A. one B. two C. three"). A key is only recognised when it is the next
 * one in sequence (A, B, C… / i, ii, iii…), so an option text starting with "A study…" is not mistaken for a key.
 * Lines without a key continue the previous option; when no line has a key, each line becomes one option.
 */
export function parseOptions(raw: string, keys: 'letter' | 'roman' = 'letter'): PastedOption[] {
  let text = raw.replace(/\r\n?/g, '\n');
  if (keys === 'letter') text = text.replace(/\s+(?=\(?[B-J][.)]\s)/g, '\n'); // "A. one B. two" on one line
  const lines = text.split('\n').map(clean).filter(Boolean);
  const re = keys === 'roman' ? /^\(?([ivxlc]{1,5})[.)]?\s+(.+)$/i : /^\(?([A-J])[.)]?\s+(.+)$/;
  const out: PastedOption[] = [];
  for (const line of lines) {
    const m = re.exec(line);
    const expected = keys === 'roman' ? romanAt(out.length) : String.fromCharCode(65 + out.length);
    const key = m?.[1] ? (keys === 'roman' ? m[1].toLowerCase() : m[1]) : null;
    if (m && key === expected) out.push({ key, text: clean(m[2] ?? '') });
    else if (out.length) {
      const last = out[out.length - 1]!;
      last.text = clean(`${last.text} ${line}`);
    } else out.push({ key: expected, text: line });
  }
  // At most one key recognised over several lines → a plain list: one option per line, text kept as is.
  if (out.length === 1 && lines.length > 1) {
    return lines.map((l, i) => ({
      key: keys === 'roman' ? romanAt(i) : String.fromCharCode(65 + i),
      text: l,
    }));
  }
  return out;
}

/** One item per non-empty line, leading question numbers ("14.", "14)", "14 ") stripped. */
export function parseLines(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => clean(l.replace(/^\s*\(?\d{1,2}[.)]?\s+/, '')))
    .filter(Boolean);
}

/**
 * Answer key → Map(number → raw answer). Accepts "14 TRUE", "14. B", "14) museum", "14: NG", one per line or
 * several per line ("1 T 2 F 3 NG"). Multi-word answers work one per line.
 */
export function parseAnswerKey(raw: string): Map<number, string> {
  const out = new Map<number, string>();
  const text = raw.replace(/\r\n?/g, '\n');
  for (const line of text.split('\n')) {
    const parts = line.split(/(?:^|\s+)(\d{1,2})\s*[.):\-–]?\s+/).slice(1);
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const n = Number(parts[i]);
      const value = clean(parts[i + 1] ?? '');
      if (n >= 1 && n <= 40 && value) out.set(n, value);
    }
  }
  return out;
}

/** "T" / "true" / "NG" / "not given" → TRUE | FALSE | NOT_GIVEN (or YES | NO | NOT_GIVEN). */
export function normalizeJudgement(value: string, kind: 'TFNG' | 'YNNG'): string | null {
  const v = value
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, ' ');
  if (v === 'NG' || v === 'NOT GIVEN' || v === 'N/G') return 'NOT_GIVEN';
  if (kind === 'TFNG') {
    if (v === 'T' || v === 'TRUE') return 'TRUE';
    if (v === 'F' || v === 'FALSE') return 'FALSE';
  } else {
    if (v === 'Y' || v === 'YES') return 'YES';
    if (v === 'N' || v === 'NO') return 'NO';
  }
  return null;
}

/** "museum / (the) museum; museums" → { answer: "museum", accepted: ["(the) museum", "museums"] }. */
export function splitAlternatives(value: string): { answer: string; accepted: string[] } {
  const parts = value
    .split(/\s+\/\s+|\s*;\s*|\s+OR\s+/)
    .map(clean)
    .filter(Boolean);
  return { answer: parts[0] ?? '', accepted: parts.slice(1) };
}

/** "B, D" / "B D" / "BD" → ["B","D"]. */
export function parseLetterSet(value: string): string[] {
  const letters = value.toUpperCase().match(/[A-J]/g) ?? [];
  return [...new Set(letters)];
}

/**
 * Gaps as printed in books → blank markers. "(14) ………", "14 ______", "………", "____", "..." become {{0}}
 * (renumbered right after); existing {{n}} markers are kept.
 */
export function blankify(text: string): string {
  return text
    .replace(/\(?\b\d{1,2}\)?\s*(?:[_…]{2,}|\.{3,}|…)/g, '{{0}}')
    .replace(/(?:_{2,}|…{2,}|\.{4,}|…\.+|\.+…)/g, '{{0}}')
    .replace(/(?<![.\w])\.{3}(?![.\w])|(?<=\s)…(?=\s|$)/g, '{{0}}');
}

/** Notes pasted from a book: "•"/"-" lines become bullets, short lines without a gap become headings. */
export function parseNoteLines(
  raw: string,
): { style: 'HEADING' | 'BULLET' | 'TEXT'; indent: number; text: string }[] {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const lead = /^[ \t]*/.exec(line)?.[0] ?? '';
      const indent = Math.min(3, Math.floor(lead.replace(/\t/g, '  ').length / 2));
      const body = line.trim();
      const bullet = /^[•\-*–·▪◦]\s*/.exec(body);
      const text = blankify(clean(bullet ? body.slice(bullet[0].length) : body));
      if (bullet) return { style: 'BULLET' as const, indent, text };
      if (!text.includes('{{') && text.length <= 60) return { style: 'HEADING' as const, indent, text };
      return { style: 'TEXT' as const, indent, text };
    });
}

/** Table pasted from a spreadsheet / PDF: tab or " | " separated cells, first row = column headers. */
export function parseTable(raw: string): { columns: string[]; rows: string[][] } | null {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  if (lines.length < 2) return null;
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : '|';
  const cells = lines.map((l) =>
    l
      .split(sep)
      .map((c) => blankify(clean(c)))
      .filter((_, i, arr) => !(sep === '|' && (i === 0 || i === arr.length - 1) && arr[i] === '')),
  );
  const width = Math.min(6, Math.max(...cells.map((r) => r.length)));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? '');
  return { columns: pad(cells[0] ?? []), rows: cells.slice(1, 21).map(pad) };
}

export interface PastedMcQuestion {
  prompt: string;
  options: PastedOption[];
}

/**
 * A block of multiple-choice questions:
 *   14 What is the main purpose of …?
 *   A first option
 *   B second option
 * A line starting with a number (or any line that is not an option while options were collected) starts a
 * new question.
 */
export function parseMcBlock(raw: string): PastedMcQuestion[] {
  const out: PastedMcQuestion[] = [];
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\s+(?=\(?[B-H][.)]\s)/g, '\n')
    .split('\n');
  for (const rawLine of lines) {
    const line = clean(rawLine);
    if (!line) continue;
    const num = /^\(?\d{1,2}[.)]?\s+(.+)$/.exec(line);
    const opt = /^\(?([A-H])[.)]?\s+(.+)$/.exec(line);
    const cur = out[out.length - 1];
    if (num) out.push({ prompt: clean(num[1] ?? ''), options: [] });
    else if (opt && cur && (cur.options.length > 0 || opt[1] === 'A'))
      cur.options.push({ key: opt[1]!, text: clean(opt[2] ?? '') });
    else if (cur && cur.options.length === 0) cur.prompt = clean(`${cur.prompt} ${line}`);
    else if (cur && cur.options.length > 0 && !opt) {
      // continuation of the last option, unless it looks like a new question sentence ending with "?"
      if (/\?$/.test(line)) out.push({ prompt: line, options: [] });
      else {
        const last = cur.options[cur.options.length - 1]!;
        last.text = clean(`${last.text} ${line}`);
      }
    } else out.push({ prompt: line, options: [] });
  }
  return out;
}
