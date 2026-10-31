import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTestNumber, readViewPref, setProgress, skillMatrix, writeViewPref } from '@/lib/test-sets';
import type { AdminSetTestDto, AdminTestSetDto, StudentTestSetDto } from '@/shared/test-sets';

const test = (n: number | null, skills: AdminSetTestDto['latest']['skills']): AdminSetTestDto => ({
  seriesKey: `cam18-t${n ?? 'x'}`,
  testNumber: n,
  title: `Test ${n ?? '?'}`,
  type: 'ACADEMIC',
  latest: { id: `0190f0c0-0000-7000-8000-00000000000${n ?? 9}`, status: 'DRAFT', version: 1, skills },
  published: null,
});

const set = (tests: AdminSetTestDto[]): AdminTestSetDto => ({
  setKey: 'CAM-18',
  source: 'CAM',
  bookNumber: 18,
  title: 'Cambridge 18',
  tests,
  counts: { draft: tests.length, published: 0 },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('skillMatrix', () => {
  it('ticks the skills of the latest version of each test', () => {
    const rows = skillMatrix(set([test(1, ['READING', 'LISTENING']), test(2, [])]));
    expect(rows[0]?.skills).toEqual({ LISTENING: true, READING: true, WRITING: false, SPEAKING: false });
    expect(rows[1]?.skills).toEqual({ LISTENING: false, READING: false, WRITING: false, SPEAKING: false });
    expect(rows[0]).toMatchObject({ seriesKey: 'cam18-t1', title: 'Test 1', status: 'DRAFT' });
  });
});

describe('nextTestNumber', () => {
  it('is one after the highest test number', () => {
    expect(nextTestNumber(set([test(1, []), test(3, []), test(null, [])]))).toBe(4);
  });

  it('starts at 1 for an empty set', () => {
    expect(nextTestNumber(set([]))).toBe(1);
  });
});

describe('view preference', () => {
  it('falls back when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readViewPref('k', 'sets')).toBe('sets');
    expect(() => writeViewPref('k', 'list')).not.toThrow();
  });

  it('remembers the last choice and ignores junk values', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    writeViewPref('k', 'list');
    expect(readViewPref('k', 'sets')).toBe('list');
    store.set('k', 'grid');
    expect(readViewPref('k', 'sets')).toBe('sets');
  });
});

describe('setProgress', () => {
  const student = (done: boolean[]): StudentTestSetDto => ({
    setKey: 'CAM-18',
    source: 'CAM',
    bookNumber: 18,
    title: 'Cambridge 18',
    tests: done.map((d) => ({ done: d }) as StudentTestSetDto['tests'][number]),
  });

  it('counts done tests', () => {
    expect(setProgress(student([true, false, false]))).toEqual({ total: 3, done: 1 });
  });

  it('is zero for an empty set', () => {
    expect(setProgress(student([]))).toEqual({ total: 0, done: 0 });
  });
});
