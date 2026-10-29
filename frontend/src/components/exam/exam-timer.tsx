'use client';

// Countdown (spec §6 P3 + decision D10): normal → ≤5 min `warning` + Clock icon → ≤1 min `danger`, mm:ss and the
// words "dưới 1 phút" (state never conveyed by colour alone). No blinking, no animation. role="timer" stays
// silent; a polite live region announces only at 10, 5 and 1 minute.
import { Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';

export type TimerLevel = 'normal' | 'warning' | 'critical';

export function timerLevel(secondsLeft: number): TimerLevel {
  if (secondsLeft <= 60) return 'critical';
  if (secondsLeft <= 5 * 60) return 'warning';
  return 'normal';
}

export function formatTimer(secondsLeft: number): string {
  const s = Math.max(0, Math.ceil(secondsLeft));
  if (s <= 60) return `0:${String(s).padStart(2, '0')}`;
  return vi.exam.timeLeft(Math.ceil(s / 60));
}

const ANNOUNCE_AT = [600, 300, 60];

export function ExamTimer({
  secondsLeft,
  hidden,
  onToggle,
}: {
  secondsLeft: number;
  hidden: boolean;
  onToggle: () => void;
}) {
  const level = timerLevel(secondsLeft);
  const [announcement, setAnnouncement] = useState('');
  const announced = useRef(new Set<number>());

  useEffect(() => {
    for (const mark of ANNOUNCE_AT) {
      if (secondsLeft <= mark && secondsLeft > mark - 2 && !announced.current.has(mark)) {
        announced.current.add(mark);
        setAnnouncement(vi.exam.timeLeft(mark / 60));
      }
    }
  }, [secondsLeft]);

  // Spec: the timer re-appears automatically in the last 5 minutes even if hidden.
  const visible = !hidden || level !== 'normal';

  return (
    <div className="flex items-center gap-3">
      {visible && (
        <span
          role="timer"
          aria-live="off"
          className={cn(
            'flex items-center gap-2 font-display text-[1.25rem] font-light font-tabular',
            level === 'normal' && 'text-ink',
            level === 'warning' && 'text-warning',
            level === 'critical' && 'text-danger',
          )}
        >
          {level !== 'normal' && <Clock className="size-[18px]" strokeWidth={1.75} aria-hidden />}
          {formatTimer(secondsLeft)}
          {level === 'critical' && (
            <span className="text-label-sm font-medium">· {vi.exam.underOneMinute}</span>
          )}
        </span>
      )}
      {level === 'normal' && (
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md px-2 py-1 text-label-sm text-ink-muted outline-none hover:text-ink focus-visible:shadow-focus"
        >
          {hidden ? vi.exam.showTimer : vi.exam.hideTimer}
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
