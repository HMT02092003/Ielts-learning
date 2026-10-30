import { describe, expect, it } from 'vitest';
import { checkText, type LtMatch } from '../../src/lib/languagetool/client';
import {
  computeMetrics,
  createLibraryWritingEvaluator,
  grammarEstimate,
  lexicalEstimate,
} from '../../src/lib/writing/library-evaluator';
import { countWords } from '../../src/shared/primitives';
import { meanBand } from '../../src/shared/writing';

const TEXT = `Cities are growing quickly. However, transport has not kept pace, which causes congestion.

For example, buses are often late because roads are crowded. Moreover, pollution increases when traffic stops.`;

const match = (offset: number, length: number, category: string): LtMatch => ({
  message: 'm',
  offset,
  length,
  replacements: [{ value: 'x' }],
  rule: { id: 'R', category: { id: category, name: category } },
});

describe('writing metrics', () => {
  it('counts words, sentences, paragraphs, linkers and complex sentences', () => {
    const m = computeMetrics(TEXT, []);
    expect(m.words).toBe(countWords(TEXT));
    expect(m.sentences).toBe(4);
    expect(m.paragraphs).toBe(2);
    expect(m.linkingWords).toBeGreaterThanOrEqual(3); // however, for example, moreover
    expect(m.complexSentenceRatio).toBe(0.75); // which / because / when
    expect(m.errorsPer100Words).toBe(0);
  });

  it('lexical and grammar estimates stay within 4–8 and explain themselves', () => {
    const m = computeMetrics(TEXT, []);
    const lex = lexicalEstimate(m, 0);
    const gra = grammarEstimate(m, 0);
    for (const e of [lex, gra]) {
      expect(e.band).toBeGreaterThanOrEqual(4);
      expect(e.band).toBeLessThanOrEqual(8);
      expect(e.band % 0.5).toBe(0);
      expect(e.evidence.length).toBeGreaterThan(0);
    }
    expect(grammarEstimate(m, 8).band).toBeLessThan(gra.band);
  });

  it('meanBand rounds to the nearest half band', () => {
    expect(meanBand([6, 6.5, 6, 6.5])).toBe(6.5); // 6.25 → 6.5
    expect(meanBand([6, 6, 5.5, 6])).toBe(6); // 5.875 → 6
    expect(meanBand([5, 5, 5, 6])).toBe(5.5); // 5.25 → 5.5
  });
});

describe('LibraryWritingEvaluator', () => {
  it('maps LanguageTool categories and keeps TR/CC checklist-only', async () => {
    const ev = createLibraryWritingEvaluator(() =>
      Promise.resolve([match(0, 6, 'GRAMMAR'), match(10, 3, 'TYPOS')]),
    );
    const out = await ev.evaluate({
      text: TEXT.repeat(3),
      task: { kind: 'ESSAY', minWords: 250, prompt: '' },
    });
    expect(out.result.issues.map((i) => i.category)).toEqual(['GRAMMAR', 'SPELLING']);
    expect(out.result.criteria.taskResponse.band).toBeNull();
    expect(out.bands.overall).toBeNull();
    expect(out.result.warnings.some((w) => w.includes('ít hơn yêu cầu 250'))).toBe(true);
    expect(out.result.disclaimer).toBe('ƯỚC LƯỢNG, không thay thế giám khảo');
  });

  it('degrades (no grammar band) when LanguageTool is down', async () => {
    const { LanguageToolUnavailable } = await import('../../src/lib/languagetool/client');
    const ev = createLibraryWritingEvaluator(() => Promise.reject(new LanguageToolUnavailable('down')));
    const out = await ev.evaluate({
      text: TEXT.repeat(3),
      task: { kind: 'ESSAY', minWords: 50, prompt: '' },
    });
    expect(out.result.degraded).toBe(true);
    expect(out.bands.grammar).toBeNull();
    expect(out.bands.lexical).not.toBeNull();
  });
});

// Contract test against the real LanguageTool container (docker compose); skipped when it is not running.
const ltUp = await fetch(`${process.env.LANGUAGETOOL_URL ?? 'http://127.0.0.1:8010'}/v2/languages`, {
  signal: AbortSignal.timeout(1500),
})
  .then((r) => r.ok)
  .catch(() => false);

describe.skipIf(!ltUp)('LanguageTool contract', () => {
  it('returns UTF-16 offsets that line up with JS strings, emoji included', async () => {
    const text = 'I like 😀 this sentense very much.';
    const matches = await checkText(text, { language: 'en-GB' });
    const typo = matches.find((m) => m.rule.category.id === 'TYPOS');
    expect(typo).toBeDefined();
    expect(text.slice(typo?.offset, (typo?.offset ?? 0) + (typo?.length ?? 0))).toBe('sentense');
  });
});
