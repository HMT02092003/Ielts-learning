// Single source of truth for answer text rules, used by import validation now and by scoring in Phase 4.
// Phase 4 refines hyphen/punctuation handling; keep every rule here.

/** Applied to BOTH the student answer and every accepted answer at scoring time (spec §6 P4). */
export function normalizeForCompare(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

const NUMBER_RE = /^\d+(?:[.,:/]\d+)*%?$/;

/** Words vs numbers in an answer, for "NO MORE THAN TWO WORDS AND/OR A NUMBER". */
export function countAnswerTokens(s: string): { words: number; numbers: number } {
  const tokens = normalizeForCompare(s).split(' ').filter(Boolean);
  const numbers = tokens.filter((t) => NUMBER_RE.test(t)).length;
  return { words: tokens.length - numbers, numbers };
}

/** "AND/OR A NUMBER" allows one extra number token on top of maxWords words; otherwise numbers count as words. */
export function fitsWordLimit(answer: string, limit: { maxWords: number; allowNumber: boolean }): boolean {
  const { words, numbers } = countAnswerTokens(answer);
  return limit.allowNumber ? words <= limit.maxWords && numbers <= 1 : words + numbers <= limit.maxWords;
}

/**
 * "(the) museum" → ["the museum", "museum"]. Round-bracket groups mark optional words; at most 3 groups
 * (2³ = 8 variants) to keep answer keys readable.
 */
export function expandOptionalParts(s: string): string[] {
  const groups = [...s.matchAll(/\(([^()]+)\)/g)];
  if (groups.length === 0) return [s.replace(/\s+/g, ' ').trim()];
  if (groups.length > 3) throw new Error(`Quá nhiều phần tùy chọn trong "${s}" (tối đa 3)`);
  const out = new Set<string>();
  for (let mask = 0; mask < 1 << groups.length; mask++) {
    let i = 0;
    const variant = s.replace(/\(([^()]+)\)/g, (_m, inner: string) => ((mask >> i++) & 1 ? inner : ''));
    out.add(variant.replace(/\s+/g, ' ').trim());
  }
  return [...out].filter(Boolean);
}
