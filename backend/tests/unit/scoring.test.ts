import { describe, expect, it } from 'vitest';
import { bandFor, bandTableIssues, DEFAULT_BAND_TABLES } from '../../src/lib/scoring/band';
import { scoreQuestions, type ScorableQuestion } from '../../src/lib/scoring/score';
import type { QuestionType } from '../../src/shared/enums';
import type { AnswerValue, CorrectAnswer } from '../../src/shared/question-types';

let n = 0;
function q(
  type: QuestionType,
  correct: CorrectAnswer,
  extra: Partial<ScorableQuestion> = {},
): ScorableQuestion {
  n += 1;
  return {
    id: `q${n}`,
    number: n,
    groupId: 'g1',
    type,
    correctAnswer: correct,
    acceptedAnswers: [],
    wordLimit: null,
    allowNumber: false,
    ...extra,
  };
}
const key = (k: string): AnswerValue => ({ kind: 'KEY', key: k });
const text = (t: string): AnswerValue => ({ kind: 'TEXT', text: t });
const one = (question: ScorableQuestion, answer: AnswerValue | null) =>
  scoreQuestions([question], new Map([[question.id, answer]]))[0];

describe('key answers (MCQ, TFNG, YNNG, matching, word bank, map options)', () => {
  it.each<[QuestionType, string, string, boolean]>([
    ['MULTIPLE_CHOICE_SINGLE', 'B', 'b', true],
    ['MULTIPLE_CHOICE_SINGLE', 'B', 'C', false],
    ['TRUE_FALSE_NOT_GIVEN', 'NOT_GIVEN', 'not given', true],
    ['TRUE_FALSE_NOT_GIVEN', 'FALSE', 'TRUE', false],
    ['YES_NO_NOT_GIVEN', 'YES', 'YES', true],
    ['MATCHING_HEADINGS', 'iv', 'IV', true],
    ['MATCHING_HEADINGS', 'iv', 'vi', false],
    ['MATCHING_INFORMATION', 'C', 'c', true],
    ['MATCHING_FEATURES', 'A', 'B', false],
    ['SUMMARY_COMPLETION', 'F', 'F', true],
    ['MAP_DIAGRAM_LABELLING', 'E', 'e', true],
  ])('%s: correct %s, answered %s → %s', (type, correct, given, ok) => {
    expect(one(q(type, { kind: 'KEY', key: correct }), key(given))?.isCorrect).toBe(ok);
  });

  it('a blank answer is wrong and marked blank', () => {
    expect(one(q('TRUE_FALSE_NOT_GIVEN', { kind: 'KEY', key: 'TRUE' }), null)).toMatchObject({
      isCorrect: false,
      notes: { blank: true },
    });
  });
});

describe('text answers (sentence/summary/note/table/flowchart/short answer/map words)', () => {
  const colour = () =>
    q(
      'SENTENCE_COMPLETION',
      { kind: 'TEXT', display: 'colour' },
      { acceptedAnswers: ['colour', 'color'], wordLimit: 2 },
    );

  it('normalises case, spaces and surrounding punctuation', () => {
    expect(one(colour(), text('  Colour. '))?.isCorrect).toBe(true);
    expect(one(colour(), text('COLOR'))?.isCorrect).toBe(true);
  });

  it('accepts every listed variant, rejects others', () => {
    expect(one(colour(), text('colours'))?.isCorrect).toBe(false);
  });

  it('marks an answer over the word limit wrong, with a note', () => {
    const res = one(
      q(
        'SHORT_ANSWER',
        { kind: 'TEXT', display: 'museum' },
        { acceptedAnswers: ['museum', 'the museum'], wordLimit: 1 },
      ),
      text('the museum'),
    );
    expect(res).toMatchObject({ isCorrect: false, notes: { wordLimitExceeded: true } });
  });

  it('"AND/OR A NUMBER" allows a number on top of the words', () => {
    const res = one(
      q(
        'NOTE_TABLE_FLOWCHART_COMPLETION',
        { kind: 'TEXT', display: '3 bottles' },
        { acceptedAnswers: ['3 bottles'], wordLimit: 1, allowNumber: true },
      ),
      text('3 bottles'),
    );
    expect(res?.isCorrect).toBe(true);
  });

  it('empty text is blank', () => {
    expect(one(colour(), text('   '))?.notes.blank).toBe(true);
  });
});

describe('MULTIPLE_CHOICE_MULTI is scored as a set', () => {
  const group = () => {
    const correct: CorrectAnswer = { kind: 'KEYS', keys: ['B', 'D'] };
    const a = q('MULTIPLE_CHOICE_MULTI', correct, { groupId: 'multi' });
    const b = q('MULTIPLE_CHOICE_MULTI', correct, { groupId: 'multi' });
    return [a, b] as const;
  };

  it('both right in any order → 2 marks', () => {
    const [a, b] = group();
    const res = scoreQuestions(
      [a, b],
      new Map([
        [a.id, key('D')],
        [b.id, key('B')],
      ]),
    );
    expect(res.map((r) => r.isCorrect)).toEqual([true, true]);
  });

  it('one right → only the first question of the group counts', () => {
    const [a, b] = group();
    const res = scoreQuestions(
      [a, b],
      new Map([
        [a.id, key('A')],
        [b.id, key('D')],
      ]),
    );
    expect(res.map((r) => r.isCorrect)).toEqual([true, false]);
  });

  it('the same letter twice counts once', () => {
    const [a, b] = group();
    const res = scoreQuestions(
      [a, b],
      new Map([
        [a.id, key('B')],
        [b.id, key('B')],
      ]),
    );
    expect(res.map((r) => r.isCorrect)).toEqual([true, false]);
  });

  it('nothing picked → both blank', () => {
    const [a, b] = group();
    const res = scoreQuestions([a, b], new Map());
    expect(res.every((r) => !r.isCorrect && r.notes.blank)).toBe(true);
  });
});

describe('band tables', () => {
  it.each(Object.entries(DEFAULT_BAND_TABLES.tables))(
    '%s covers 0..40 without gaps or overlaps',
    (_k, rows) => {
      expect(bandTableIssues(rows)).toEqual([]);
    },
  );

  it('matches the IDP anchor points', () => {
    const { LISTENING, READING_ACADEMIC, READING_GENERAL } = DEFAULT_BAND_TABLES.tables;
    expect([16, 23, 30, 35, 40].map((r) => bandFor(LISTENING, r))).toEqual([5, 6, 7, 8, 9]);
    expect([15, 23, 30, 35, 40].map((r) => bandFor(READING_ACADEMIC, r))).toEqual([5, 6, 7, 8, 9]);
    expect([15, 23, 30, 35].map((r) => bandFor(READING_GENERAL, r))).toEqual([4, 5, 6, 7]);
  });

  it('detects a gap and a decreasing band', () => {
    expect(
      bandTableIssues([
        { minRaw: 0, maxRaw: 20, band: 5 },
        { minRaw: 22, maxRaw: 40, band: 4 },
      ]),
    ).toEqual(expect.arrayContaining(['Thiếu điểm: 21']));
    expect(
      bandTableIssues([
        { minRaw: 0, maxRaw: 20, band: 5 },
        { minRaw: 21, maxRaw: 40, band: 4 },
      ]),
    ).toEqual(['Band giảm khi điểm tăng (20 → 21)']);
  });
});
