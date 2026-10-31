import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as DbEnums from '../../src/generated/prisma/enums';
import { ALL_ENUMS } from '../../src/shared/enums';
import { zodIssues } from '../../src/shared/errors';
import { countWords } from '../../src/shared/primitives';
import { QuestionGroupConfig } from '../../src/shared/question-types';
import { checkPublishable, TestImportDoc } from '../../src/shared/test-import';
import { parseSetKey, setKeyOf, setTitleOf } from '../../src/shared/test-sets';

const FIXTURES = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'seed', 'fixtures');
const readFixture = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));

describe('enum parity: src/shared ↔ Prisma', () => {
  it.each(Object.entries(ALL_ENUMS))('%s matches the Prisma enum', (name, zodEnum) => {
    const db = (DbEnums as Record<string, Record<string, string> | undefined>)[name];
    expect(db, `Prisma enum ${name} missing`).toBeDefined();
    expect(Object.values(db ?? {}).sort()).toEqual([...zodEnum.options].sort());
  });
});

describe('dummy fixtures', () => {
  it.each(['dummy-reading.json', 'dummy-listening.json', 'dummy-writing.json', 'dummy-speaking.json'])(
    '%s is a valid, publishable import document',
    (name) => {
      const parsed = TestImportDoc.safeParse(readFixture(name));
      expect(parsed.success ? [] : zodIssues(parsed.error)).toEqual([]);
      if (parsed.success) expect(checkPublishable(parsed.data)).toEqual([]);
    },
  );

  it('Reading + Listening fixtures cover all 12 question types', () => {
    const types = new Set<string>();
    for (const name of ['dummy-reading.json', 'dummy-listening.json']) {
      const doc = TestImportDoc.parse(readFixture(name));
      doc.reading?.passages.forEach((p) => p.groups.forEach((g) => types.add(g.type)));
      doc.listening?.parts.forEach((p) => p.groups.forEach((g) => types.add(g.type)));
    }
    expect(types.size).toBe(12);
  });
});

describe('TestImportDoc error paths', () => {
  it('reports a precise path for an answer that is not an option', () => {
    const doc = readFixture('dummy-reading.json') as {
      reading: { passages: { groups: { questions: { answer: unknown }[] }[] }[] };
    };
    const q = doc.reading.passages[2]?.groups[1]?.questions[0];
    if (!q) throw new Error('fixture shape changed');
    q.answer = 'Z';
    const parsed = TestImportDoc.safeParse(doc);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(zodIssues(parsed.error).map((i) => i.path)).toContain(
        'reading.passages[2].groups[1].questions[0].answer',
      );
    }
  });

  it('detects blank markers that do not match question numbers', () => {
    const cfg = {
      type: 'SUMMARY_COMPLETION',
      text: 'Only {{1}} here',
      answerMode: 'WORDS',
      wordLimit: { maxWords: 1 },
    };
    expect(QuestionGroupConfig.safeParse(cfg).success).toBe(true); // config alone has no numbering…
    const doc = {
      schemaVersion: 1,
      seriesKey: 'blank-check',
      source: 'CUSTOM',
      type: 'ACADEMIC',
      title: 't',
      listening: {
        parts: [
          {
            audio: { file: { path: 'assets/a.wav' }, durationMs: 1000 },
            groups: [
              {
                ...cfg,
                instructions: 'Complete.',
                questionFrom: 1,
                questionTo: 2,
                questions: [
                  { number: 1, answer: 'a' },
                  { number: 2, answer: 'b' },
                ],
              },
            ],
          },
        ],
      },
    };
    const parsed = TestImportDoc.safeParse(doc);
    expect(parsed.success).toBe(false); // …but the import document checks it
  });
});

describe('countWords', () => {
  it('counts words and ignores punctuation-only tokens', () => {
    expect(countWords('  The chart shows — three routes.  ')).toBe(5);
    expect(countWords('')).toBe(0);
  });
});

describe('test sets', () => {
  it('builds set keys from source and book number', () => {
    expect(setKeyOf('CAM', 18)).toBe('CAM-18');
    expect(setKeyOf('VOL', null)).toBe('VOL-none');
  });

  it('parses valid set keys and rejects anything else', () => {
    expect(parseSetKey('PRE_IELTS-3')).toEqual({ source: 'PRE_IELTS', bookNumber: 3 });
    expect(parseSetKey('CUSTOM-none')).toEqual({ source: 'CUSTOM', bookNumber: null });
    expect(parseSetKey('CAM-0')).toBeNull();
    expect(parseSetKey('XYZ-1')).toBeNull();
    expect(parseSetKey('CAM-../x')).toBeNull();
  });

  it('names sets after the book', () => {
    expect(setTitleOf('CAM', 18)).toBe('Cambridge 18');
    expect(setTitleOf('VOL', 2)).toBe('Volume 2');
    expect(setTitleOf('PRE_IELTS', 1)).toBe('Pre-IELTS 1');
    expect(setTitleOf('CUSTOM', null)).toBe('Tự soạn — đề lẻ');
  });
});
