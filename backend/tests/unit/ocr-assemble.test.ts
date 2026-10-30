import { describe, expect, it } from 'vitest';
import { assembleDoc, guessTags, guessType } from '../../src/modules/ocr/assemble';
import type { ReviewBlock } from '../../src/shared/ocr';
import { TestImportDoc } from '../../src/shared/test-import';

describe('guessTags', () => {
  it('uses context: a lettered line is an option only after a question', () => {
    expect(
      guessTags([
        'Rooftop Beekeeping',
        'A When the city relaxed its rules, owners placed hives.',
        'Questions 1-2',
        '1 Which statement is true?',
        'A Bees prefer roofs',
        'B Bees prefer parks',
        'Answer key\n1 A',
      ]),
    ).toEqual(['PASSAGE', 'PASSAGE', 'INSTRUCTION', 'QUESTION', 'OPTION', 'OPTION', 'ANSWER']);
  });
});

describe('guessType', () => {
  it.each([
    ['Do the following statements agree? Write TRUE, FALSE or NOT GIVEN', 'TRUE_FALSE_NOT_GIVEN'],
    ['Write YES, NO or NOT GIVEN', 'YES_NO_NOT_GIVEN'],
    ['Choose the correct heading from the list of headings below', 'MATCHING_HEADINGS'],
    ['Choose TWO letters, A-E.', 'MULTIPLE_CHOICE_MULTI'],
    ['Choose the correct letter, A, B, C or D.', 'MULTIPLE_CHOICE_SINGLE'],
    ['Complete the sentences below. Choose NO MORE THAN TWO WORDS', 'SENTENCE_COMPLETION'],
    ['Answer the questions below.', 'SHORT_ANSWER'],
  ])('%s → %s', (text, type) => {
    expect(guessType(text)).toBe(type);
  });
});

describe('assembleDoc', () => {
  const block = (tag: ReviewBlock['tag'], text: string, i: number): ReviewBlock => ({
    id: `b${i}`,
    pageNumber: 1,
    sourceIds: [],
    tag,
    text,
  });

  it('builds a passage with labelled paragraphs and a TFNG group from tagged blocks + answer key', () => {
    const blocks = [
      block('PASSAGE', 'Rooftop Beekeeping in Northbridge', 0),
      block('PASSAGE', 'A When the city relaxed its rules in 2009, owners placed hives on roofs.', 1),
      block('PASSAGE', 'B Supporters argue that city bees are healthier.', 2),
      block('INSTRUCTION', 'Questions 1-2\nWrite TRUE, FALSE or NOT GIVEN.', 3),
      block('QUESTION', '1 The first hives came before 2009.\n2 City bees are healthier.', 4),
    ];
    const doc = assembleDoc(
      blocks,
      { '1': ['FALSE'], '2': ['NOT GIVEN'] },
      {
        seriesKey: 'ocr-demo',
        title: 'OCR demo',
        source: 'CUSTOM',
        type: 'ACADEMIC',
      },
    );
    const parsed = TestImportDoc.safeParse(doc);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const passage = parsed.data.reading?.passages[0];
    expect(passage?.title).toBe('Rooftop Beekeeping in Northbridge');
    expect(passage?.paragraphs.map((p) => p.label)).toEqual(['A', 'B']);
    expect(passage?.groups[0]).toMatchObject({
      type: 'TRUE_FALSE_NOT_GIVEN',
      questionFrom: 1,
      questionTo: 2,
    });
  });
});
