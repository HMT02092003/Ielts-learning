import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyAnswerKey } from '@/lib/builder/answers';
import { blanksInOrder, renumberDoc, renumberGroup } from '@/lib/builder/numbering';
import {
  blankify,
  normalizeJudgement,
  parseAnswerKey,
  parseLetterSet,
  parseLines,
  parseMcBlock,
  parseNoteLines,
  parseOptions,
  parseTable,
  splitAlternatives,
  splitParagraphs,
} from '@/lib/builder/paste';
import { toContentGroup } from '@/lib/builder/preview';
import { defaultInstructions, newGroup, QUESTION_TYPES, wordLimitText } from '@/lib/builder/templates';
import type { Doc, Group, GroupOf } from '@/lib/builder/types';
import { humanPath, issuesUnder, validateDoc } from '@/lib/builder/validate';

const fixture = (name: string): Doc =>
  JSON.parse(
    readFileSync(path.resolve(__dirname, `../../backend/prisma/seed/fixtures/${name}`), 'utf8'),
  ) as Doc;

describe('renumberDoc on real fixtures', () => {
  for (const name of ['dummy-reading.json', 'dummy-listening.json']) {
    it(`${name}: is a no-op and the doc stays publishable`, () => {
      const doc = fixture(name);
      const before = JSON.stringify(doc);
      renumberDoc(doc);
      expect(JSON.stringify(doc)).toBe(before);
      const v = validateDoc(doc);
      expect(v.issues.filter((i) => i.level === 'draft')).toEqual([]);
      expect(v.canSave).toBe(true);
    });
  }

  it('renumbers continuously across passages after a group is removed', () => {
    const doc = fixture('dummy-reading.json');
    const first = doc.reading!.passages[0]!;
    const removed = first.groups[0]!.questions.length;
    first.groups.splice(0, 1);
    renumberDoc(doc);
    const numbers = doc.reading!.passages.flatMap((p) =>
      p.groups.flatMap((g) => g.questions.map((q) => q.number)),
    );
    expect(numbers).toEqual(Array.from({ length: 40 - removed }, (_, i) => i + 1));
    // blanks follow their questions
    for (const p of doc.reading!.passages)
      for (const g of p.groups)
        if (g.type === 'SUMMARY_COMPLETION' || g.type === 'NOTE_TABLE_FLOWCHART_COMPLETION')
          expect(blanksInOrder(g)).toEqual(g.questions.map((q) => q.number));
    expect(validateDoc(doc).issues.filter((i) => i.level === 'draft')).toEqual([]);
  });
});

describe('renumberGroup', () => {
  it('turns inserted {{0}} gaps into questions and keeps answers of existing gaps', () => {
    const g = newGroup('SUMMARY_COMPLETION', 'reading') as GroupOf<'SUMMARY_COMPLETION'>;
    g.text = 'One {{5}} two {{0}} three {{6}}';
    g.questions = [
      { number: 5, answer: 'alpha', accepted: [] },
      { number: 6, answer: 'gamma', accepted: ['g'] },
    ];
    const next = renumberGroup(g, 14);
    expect(next).toBe(17);
    expect(g.text).toBe('One {{14}} two {{15}} three {{16}}');
    expect(g.questions.map((q) => [q.number, q.answer])).toEqual([
      [14, 'alpha'],
      [15, ''],
      [16, 'gamma'],
    ]);
    expect(g.questionFrom).toBe(14);
    expect(g.questionTo).toBe(16);
  });

  it('removes the question of a deleted gap', () => {
    const g = newGroup(
      'NOTE_TABLE_FLOWCHART_COMPLETION',
      'listening',
    ) as GroupOf<'NOTE_TABLE_FLOWCHART_COMPLETION'>;
    renumberGroup(g, 1);
    g.questions[1]!.answer = 'keep';
    if (g.template.layout === 'NOTES') g.template.lines[1]!.text = 'no gap any more';
    renumberGroup(g, 1);
    expect(g.questions).toHaveLength(1);
    expect(g.questions[0]).toMatchObject({ number: 1, answer: 'keep' });
  });

  it('rewrites the gap inside sentence-completion prompts', () => {
    const g = newGroup('SENTENCE_COMPLETION', 'reading');
    renumberGroup(g, 8);
    expect(g.questions.map((q) => ('prompt' in q ? q.prompt : ''))).toEqual(['{{8}}', '{{9}}', '{{10}}']);
  });
});

describe('templates', () => {
  it('every type has a starter group with standard instructions', () => {
    for (const type of QUESTION_TYPES) {
      const skill =
        type === 'TRUE_FALSE_NOT_GIVEN' ||
        type === 'YES_NO_NOT_GIVEN' ||
        type === 'MATCHING_HEADINGS' ||
        type === 'MATCHING_INFORMATION'
          ? 'reading'
          : 'listening';
      const g = newGroup(type, skill, ['A', 'B', 'C', 'D']);
      expect(g.type).toBe(type);
      expect(g.instructions.length).toBeGreaterThan(10);
      expect(g.instructions).toBe(defaultInstructions(g, skill));
      renumberGroup(g, 1);
      expect(g.questions.length).toBeGreaterThan(0);
      expect(g.questions.map((q) => q.number)).toEqual(g.questions.map((_, i) => i + 1));
    }
  });

  it('writes word limits the IELTS way', () => {
    expect(wordLimitText({ maxWords: 2, allowNumber: true })).toBe('NO MORE THAN TWO WORDS AND/OR A NUMBER');
    expect(wordLimitText({ maxWords: 1, allowNumber: false })).toBe('ONE WORD ONLY');
    expect(wordLimitText({ maxWords: 0, allowNumber: true })).toBe('A NUMBER');
  });

  it('instructions follow the settings (listening wording differs)', () => {
    const g = newGroup('SENTENCE_COMPLETION', 'listening');
    expect(g.instructions).toContain('Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.');
    const r = newGroup('SENTENCE_COMPLETION', 'reading');
    expect(r.instructions).toContain('Choose NO MORE THAN TWO WORDS from the passage for each answer.');
  });
});

describe('paste parsers', () => {
  it('splits a passage and keeps printed labels', () => {
    const paras = splitParagraphs('A  First para\nwrapped line.\n\nB Second para.\n\n[C] Third.');
    expect(paras).toEqual([
      { label: 'A', text: 'First para wrapped line.' },
      { label: 'B', text: 'Second para.' },
      { label: 'C', text: 'Third.' },
    ]);
  });

  it('labels unlabelled paragraphs A, B, C', () => {
    expect(splitParagraphs('one\n\ntwo').map((p) => p.label)).toEqual(['A', 'B']);
  });

  it('parses options on separate lines or on one line', () => {
    expect(parseOptions('A. cats\nB. dogs\nC) birds')).toEqual([
      { key: 'A', text: 'cats' },
      { key: 'B', text: 'dogs' },
      { key: 'C', text: 'birds' },
    ]);
    expect(parseOptions('A. one B. two C. three').map((o) => o.text)).toEqual(['one', 'two', 'three']);
    expect(parseOptions('A study of bees\nA new method').map((o) => o.key)).toEqual(['A', 'B']);
  });

  it('parses roman-numbered headings', () => {
    expect(parseOptions('i The start\nii A change\niii The end', 'roman')).toEqual([
      { key: 'i', text: 'The start' },
      { key: 'ii', text: 'A change' },
      { key: 'iii', text: 'The end' },
    ]);
  });

  it('strips question numbers from lines', () => {
    expect(parseLines('14. First\n15) Second\n\n16 Third')).toEqual(['First', 'Second', 'Third']);
  });

  it('reads answer keys in several layouts', () => {
    expect([...parseAnswerKey('1 TRUE 2 F 3 NG')]).toEqual([
      [1, 'TRUE'],
      [2, 'F'],
      [3, 'NG'],
    ]);
    expect(parseAnswerKey('14. (the) museum / museums\n15: B').get(14)).toBe('(the) museum / museums');
    expect(parseAnswerKey('14. (the) museum / museums\n15: B').get(15)).toBe('B');
  });

  it('normalises judgements and alternatives', () => {
    expect(normalizeJudgement('ng', 'TFNG')).toBe('NOT_GIVEN');
    expect(normalizeJudgement('Not Given', 'YNNG')).toBe('NOT_GIVEN');
    expect(normalizeJudgement('y', 'YNNG')).toBe('YES');
    expect(normalizeJudgement('yes', 'TFNG')).toBeNull();
    expect(splitAlternatives('colour / color; colours')).toEqual({
      answer: 'colour',
      accepted: ['color', 'colours'],
    });
    expect(parseLetterSet('B, D')).toEqual(['B', 'D']);
  });

  it('parses a multiple-choice block', () => {
    const qs = parseMcBlock('1 What is it?\nA one\nB two\nC three\n2 Why?\nA. x B. y C. z');
    expect(qs).toHaveLength(2);
    expect(qs[0]).toEqual({
      prompt: 'What is it?',
      options: [
        { key: 'A', text: 'one' },
        { key: 'B', text: 'two' },
        { key: 'C', text: 'three' },
      ],
    });
    expect(qs[1]!.options.map((o) => o.text)).toEqual(['x', 'y', 'z']);
  });

  it('turns printed gaps into blanks', () => {
    expect(blankify('They arrived in (14) …… and built (15) ______ houses.')).toBe(
      'They arrived in {{0}} and built {{0}} houses.',
    );
    expect(blankify('Cost: £ ........')).toBe('Cost: £ {{0}}');
    expect(blankify('keep {{3}} as is')).toBe('keep {{3}} as is');
  });

  it('parses notes and tables', () => {
    const lines = parseNoteLines('Customer details\n• Name: Sarah ……\n  - Postcode: ____');
    expect(lines).toEqual([
      { style: 'HEADING', indent: 0, text: 'Customer details' },
      { style: 'BULLET', indent: 0, text: 'Name: Sarah {{0}}' },
      { style: 'BULLET', indent: 1, text: 'Postcode: {{0}}' },
    ]);
    expect(parseTable('Event\tDate\nTalk\t……')).toEqual({
      columns: ['Event', 'Date'],
      rows: [['Talk', '{{0}}']],
    });
  });
});

describe('applyAnswerKey', () => {
  it('fills TFNG answers and rejects invalid values', () => {
    const g = newGroup('TRUE_FALSE_NOT_GIVEN', 'reading');
    renumberGroup(g, 1);
    const res = applyAnswerKey(g, parseAnswerKey('1 T 2 NG 3 maybe 9 TRUE'));
    expect(res.applied).toBe(2);
    expect(res.rejected).toEqual(['3: maybe']);
    expect(g.questions.map((q) => (q as { answer: string }).answer)).toEqual(['TRUE', 'NOT_GIVEN', '']);
  });

  it('splits accepted variants for text answers', () => {
    const g = newGroup('SHORT_ANSWER', 'listening');
    renumberGroup(g, 21);
    applyAnswerKey(g, parseAnswerKey('21 (the) library / libraries'));
    expect(g.questions[0]).toMatchObject({ answer: '(the) library', accepted: ['libraries'] });
  });

  it('collects the letter set of a choose-N group', () => {
    const g = newGroup('MULTIPLE_CHOICE_MULTI', 'reading') as GroupOf<'MULTIPLE_CHOICE_MULTI'>;
    renumberGroup(g, 21);
    applyAnswerKey(g, parseAnswerKey('21 B\n22 D'));
    expect(g.answer).toEqual(['B', 'D']);
  });
});

describe('preview + validation helpers', () => {
  it('builds a content group without answers', () => {
    const g = newGroup('MULTIPLE_CHOICE_MULTI', 'reading') as Group;
    (g as GroupOf<'MULTIPLE_CHOICE_MULTI'>).answer = ['A', 'B'];
    renumberGroup(g, 1);
    const c = toContentGroup(g, 'x');
    expect(c.config).not.toHaveProperty('answer');
    expect(c.questions.map((q) => q.id)).toEqual(['x-q1', 'x-q2']);
  });

  it('humanises issue paths and filters by prefix', () => {
    expect(humanPath('reading.passages[1].groups[0].questions[2].answer')).toBe(
      'Reading › Passage 2 › Nhóm 1 › Câu thứ 3 › answer',
    );
    const issues = [
      { path: 'reading.passages[0].groups[1].stem', message: 'x', level: 'draft' as const },
      { path: 'reading.passages[0].groups[10]', message: 'y', level: 'draft' as const },
    ];
    expect(issuesUnder(issues, 'reading.passages[0].groups[1]')).toHaveLength(1);
  });
});

describe('friendly validation messages', () => {
  it('reports empty fields in Vietnamese', () => {
    const doc = fixture('dummy-reading.json');
    const g = doc.reading!.passages[0]!.groups[0]!;
    (g.questions[0] as { answer: string }).answer = '';
    doc.reading!.passages[0]!.title = '';
    const msgs = validateDoc(doc).issues.map((i) => i.message);
    expect(msgs.some((m) => m === 'Chưa có đáp án' || m === 'Chưa chọn đáp án')).toBe(true);
    expect(msgs).toContain('Chưa nhập tiêu đề');
    expect(msgs.join(' ')).not.toMatch(/expected|Too small/);
  });
});
