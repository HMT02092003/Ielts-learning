import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { answerParts, setAt, syncLines } from '@/lib/answer-doc';

const fixture: unknown = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../backend/prisma/seed/fixtures/dummy-reading.json'), 'utf8'),
);

describe('answerParts', () => {
  const parts = answerParts(fixture);

  it('reads every reading passage with its paragraphs', () => {
    expect(parts).toHaveLength(3);
    expect(parts[0]?.skill).toBe('READING');
    expect(parts[0]?.title).toBe('Rooftop Beekeeping in Northbridge');
    expect(parts[0]?.paragraphs).toHaveLength(5);
    expect(parts[0]?.paragraphs[0]?.label).toBe('A');
    expect(parts[0]?.transcript).toBeNull();
  });

  it('offers the judgement keys for TFNG', () => {
    const g = parts[0]!.groups[0]!;
    expect(g.type).toBe('TRUE_FALSE_NOT_GIVEN');
    expect([g.from, g.to]).toEqual([1, 5]);
    expect(g.choices?.map((c) => c.key)).toEqual(['TRUE', 'FALSE', 'NOT_GIVEN']);
    expect(g.choices?.[2]?.text).toBe('NOT GIVEN');
    expect(g.questions[0]?.answer).toBe('FALSE');
    expect(g.questions[0]?.path).toEqual(['reading', 'passages', 0, 'groups', 0, 'questions', 0]);
  });

  it('uses free text for sentence completion and note completion in WORDS mode', () => {
    expect(parts[0]!.groups[1]!.choices).toBeNull();
    expect(parts[0]!.groups[1]!.questions[0]?.answer).toBe('harbour district');
    expect(parts[0]!.groups[2]!.choices).toBeNull();
  });

  it('hides the example heading and labels heading rows by paragraph', () => {
    const g = parts[1]!.groups[0]!;
    expect(g.choices?.map((c) => c.key)).not.toContain('iv');
    expect(g.choices).toHaveLength(7);
    expect(g.questions[0]?.label).toBe('Đoạn B');
  });

  it('keeps the MC multi answer on the group', () => {
    expect(parts[1]!.groups[3]!.multi).toEqual({ chooseCount: 2, answer: ['A', 'C'] });
    expect(parts[1]!.groups[3]!.choices?.length).toBeGreaterThanOrEqual(3);
  });

  it('gives MC single questions their own options', () => {
    const g = parts[2]!.groups[1]!;
    expect(g.perQuestionChoices).toBe(true);
    expect(g.questions[0]?.choices).toHaveLength(4);
  });

  it('uses word bank keys in WORD_BANK mode', () => {
    expect(parts[2]!.groups[2]!.choices?.map((c) => c.key)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });

  it('never throws on broken drafts', () => {
    expect(answerParts(null)).toEqual([]);
    expect(answerParts('x')).toEqual([]);
    const broken = answerParts({ reading: { passages: [{ groups: [{ type: 'SHORT_ANSWER' }] }] } });
    expect(broken[0]?.groups[0]?.questions).toEqual([]);
    const noAnswer = answerParts({
      reading: { passages: [{ groups: [{ type: 'SHORT_ANSWER', questions: [{ number: 1 }] }] }] },
    });
    expect(noAnswer[0]?.groups[0]?.questions[0]).toMatchObject({ answer: '', accepted: [], explanation: '' });
  });

  it('reads listening transcripts', () => {
    const [p] = answerParts({
      listening: { parts: [{ title: 'P1', audio: { transcript: 'hello' }, groups: [] }] },
    });
    expect(p).toMatchObject({ skill: 'LISTENING', title: 'P1', transcript: 'hello', paragraphs: [] });
  });
});

describe('setAt', () => {
  const doc = { a: [{ b: 1, c: 'x' }], d: { e: 2 } };

  it('returns a new doc and leaves the original unchanged', () => {
    const next = setAt(doc, ['a', 0, 'b'], 5) as typeof doc;
    expect(next.a[0]?.b).toBe(5);
    expect(doc.a[0]?.b).toBe(1);
    expect(next.a).not.toBe(doc.a);
    expect(next.d).toBe(doc.d);
  });

  it('removes the key when the value is undefined', () => {
    const next = setAt(doc, ['a', 0, 'c'], undefined) as typeof doc;
    expect('c' in next.a[0]!).toBe(false);
  });
});

describe('syncLines', () => {
  it('settles in one step even when the value has blanks or untrimmed entries', () => {
    const value = [' museum', ''];
    const first = syncLines({ key: 'old', text: 'old' }, value);
    expect(first).toEqual({ key: ' museum\n', text: ' museum\n' });
    expect(syncLines(first!, value)).toBeNull();
  });

  it('keeps the typed text when the value only echoes it', () => {
    expect(syncLines({ key: 'a', text: 'a' }, ['a'])).toBeNull();
    expect(syncLines({ key: 'a', text: 'a\n' }, ['a'])).toBeNull();
    expect(syncLines({ key: 'a', text: 'a\n' }, ['a', 'b'])).toEqual({ key: 'a\nb', text: 'a\nb' });
  });

  it('records a new value without touching text that already matches it', () => {
    expect(syncLines({ key: 'a', text: 'a\nb\n' }, ['a', 'b'])).toEqual({ key: 'a\nb', text: 'a\nb\n' });
  });
});
