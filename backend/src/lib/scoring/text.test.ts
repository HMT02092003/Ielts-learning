import { describe, expect, it } from 'vitest';
import { countAnswerTokens, expandOptionalParts, fitsWordLimit, normalizeForCompare } from './text';

describe('normalizeForCompare', () => {
  it('trims, lower-cases and collapses spaces', () => {
    expect(normalizeForCompare('  The   Old\tMill ')).toBe('the old mill');
  });
});

describe('expandOptionalParts', () => {
  it('returns the input when there is no optional part', () => {
    expect(expandOptionalParts('colour')).toEqual(['colour']);
  });
  it('expands one optional group', () => {
    expect(expandOptionalParts('(the) museum').sort()).toEqual(['museum', 'the museum']);
  });
  it('expands two optional groups', () => {
    expect(expandOptionalParts('(a) small (wooden) box').sort()).toEqual([
      'a small box',
      'a small wooden box',
      'small box',
      'small wooden box',
    ]);
  });
  it('rejects more than three optional groups', () => {
    expect(() => expandOptionalParts('(a) (b) (c) (d)')).toThrow();
  });
});

describe('word limits', () => {
  it('counts numbers separately from words', () => {
    expect(countAnswerTokens('2 hours')).toEqual({ words: 1, numbers: 1 });
  });
  it('TWO WORDS AND/OR A NUMBER accepts "3 green bottles"', () => {
    expect(fitsWordLimit('3 green bottles', { maxWords: 2, allowNumber: true })).toBe(true);
  });
  it('ONE WORD ONLY rejects two words', () => {
    expect(fitsWordLimit('green bottles', { maxWords: 1, allowNumber: false })).toBe(false);
  });
});
