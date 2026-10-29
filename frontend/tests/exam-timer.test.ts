import { describe, expect, it } from 'vitest';
import { formatTimer, timerLevel } from '@/components/exam/exam-timer';

describe('exam timer thresholds (5 min / 1 min)', () => {
  it.each([
    [38 * 60, 'normal'],
    [5 * 60 + 1, 'normal'],
    [5 * 60, 'warning'],
    [61, 'warning'],
    [60, 'critical'],
    [0, 'critical'],
  ] as const)('%i s → %s', (s, level) => {
    expect(timerLevel(s)).toBe(level);
  });

  it('shows minutes above one minute and m:ss below', () => {
    expect(formatTimer(38 * 60)).toBe('38 phút còn lại');
    expect(formatTimer(90)).toBe('2 phút còn lại');
    expect(formatTimer(59)).toBe('0:59');
    expect(formatTimer(-3)).toBe('0:00');
  });
});
