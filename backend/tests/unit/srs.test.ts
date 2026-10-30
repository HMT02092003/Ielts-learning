import { describe, expect, it } from 'vitest';
import { addDays, dayRange, localDate } from '../../src/lib/tz';
import { gapLabel, nextEase, preview, schedule, type SrsCard } from '../../src/shared/study';

const NOW = new Date('2026-10-30T03:00:00.000Z');
const fresh: SrsCard = {
  state: 'NEW',
  learningStep: 0,
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
};

describe('SM-2 + learning steps', () => {
  it('new card buttons match C-Flashcard: <1 phút / 6 phút / 1 ngày / 4 ngày', () => {
    expect(preview(fresh, NOW)).toEqual({ AGAIN: '<1 phút', HARD: '6 phút', GOOD: '1 ngày', EASY: '4 ngày' });
  });

  it('graduates to REVIEW and grows the interval with the ease factor', () => {
    const r1 = schedule(fresh, 'GOOD', NOW);
    expect(r1).toMatchObject({ state: 'REVIEW', intervalDays: 1, repetitions: 1 });
    const r2 = schedule(r1, 'GOOD', r1.dueAt);
    expect(r2.intervalDays).toBeGreaterThan(1);
    const r3 = schedule(r2, 'GOOD', r2.dueAt);
    expect(r3.intervalDays).toBeGreaterThan(r2.intervalDays);
  });

  it('HARD < GOOD < EASY on a review card', () => {
    const card: SrsCard = { ...fresh, state: 'REVIEW', intervalDays: 10, repetitions: 3 };
    const h = schedule(card, 'HARD', NOW).intervalDays;
    const g = schedule(card, 'GOOD', NOW).intervalDays;
    const e = schedule(card, 'EASY', NOW).intervalDays;
    expect(h).toBeLessThan(g);
    expect(g).toBeLessThan(e);
  });

  it('a lapse goes to RELEARNING, counts the lapse and lowers the ease (min 1.3)', () => {
    const card: SrsCard = { ...fresh, state: 'REVIEW', intervalDays: 20, repetitions: 5, easeFactor: 1.35 };
    const r = schedule(card, 'AGAIN', NOW);
    expect(r).toMatchObject({ state: 'RELEARNING', lapses: 1, intervalDays: 1 });
    expect(r.easeFactor).toBe(1.3);
    expect(schedule(r, 'GOOD', NOW).state).toBe('REVIEW');
  });

  it('EF formula: q=5 raises by 0.1, q=4 keeps, q=3 lowers by 0.14', () => {
    expect(nextEase(2.5, 5)).toBe(2.6);
    expect(nextEase(2.5, 4)).toBe(2.5);
    expect(nextEase(2.5, 3)).toBe(2.36);
  });

  it('gap labels', () => {
    expect(gapLabel(30_000)).toBe('<1 phút');
    expect(gapLabel(6 * 60_000)).toBe('6 phút');
    expect(gapLabel(3 * 86_400_000)).toBe('3 ngày');
    expect(gapLabel(90 * 86_400_000)).toBe('3 tháng');
  });
});

describe('calendar days in APP_TIMEZONE', () => {
  it('maps instants to local dates and back (Asia/Ho_Chi_Minh, UTC+7)', () => {
    expect(localDate(new Date('2026-10-29T18:30:00Z'), 'Asia/Ho_Chi_Minh')).toBe('2026-10-30');
    const r = dayRange('2026-10-30', 'Asia/Ho_Chi_Minh');
    expect(r.start.toISOString()).toBe('2026-10-29T17:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-10-30T17:00:00.000Z');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
