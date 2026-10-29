'use client';

// Bottom question navigator (design-system.md §6 "Question-nav button"). States combine:
// unanswered / answered (accent-soft + inset bar) / flagged (corner triangle) / current (ink).
// Never colour alone: answered has an underline bar, flagged a corner shape, current aria-current.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';

interface NavButtonProps {
  number: number;
  answered: boolean;
  flagged: boolean;
  current: boolean;
  onSelect: (n: number) => void;
}

export function QuestionNavButton({ number, answered, flagged, current, onSelect }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(number)}
      aria-current={current || undefined}
      aria-label={vi.exam.navLabel(number, answered, flagged)}
      className={cn(
        'relative flex size-10 shrink-0 items-center justify-center rounded-md text-body outline-none focus-visible:shadow-focus max-lg:size-11',
        current
          ? 'border-2 border-ink bg-ink font-semibold text-ink-inverse'
          : answered
            ? 'border border-accent-soft bg-accent-soft font-semibold text-accent shadow-[inset_0_-3px_0_var(--accent)]'
            : 'border border-border-strong bg-surface text-ink',
      )}
    >
      {number}
      {flagged && (
        <span
          aria-hidden
          className="absolute top-0 right-0 size-3 rounded-tr-md bg-warning [clip-path:polygon(0_0,100%_0,100%_100%)]"
        />
      )}
    </button>
  );
}

export interface NavPart {
  part: number;
  numbers: number[];
}

interface NavBarProps {
  parts: NavPart[];
  current: number;
  answered: ReadonlySet<number>;
  flagged: ReadonlySet<number>;
  onSelect: (n: number) => void;
}

/** Only the current part is expanded; other parts collapse to "Part n · x/y" (click expands = jump). */
export function QuestionNavBar({ parts, current, answered, flagged, onSelect }: NavBarProps) {
  const all = parts.flatMap((p) => p.numbers);
  const idx = all.indexOf(current);
  const go = (delta: number) => {
    const next = all[idx + delta];
    if (next !== undefined) onSelect(next);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  };

  return (
    <nav
      aria-label="Điều hướng câu hỏi"
      onKeyDown={onKeyDown}
      className="flex items-center gap-3 border-t border-border bg-surface px-4 py-3"
    >
      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {parts.map((p) => {
          const isCurrentPart = p.numbers.includes(current);
          if (!isCurrentPart) {
            const done = p.numbers.filter((n) => answered.has(n)).length;
            return (
              <button
                key={p.part}
                type="button"
                onClick={() => p.numbers[0] !== undefined && onSelect(p.numbers[0])}
                className="flex h-10 shrink-0 items-center rounded-md border border-border bg-surface-muted px-3 text-body text-ink outline-none focus-visible:shadow-focus"
              >
                {vi.exam.partSummary(p.part, done, p.numbers.length)}
              </button>
            );
          }
          return (
            <div
              key={p.part}
              className="flex shrink-0 items-center gap-1.5"
              role="group"
              aria-label={`Part ${p.part}`}
            >
              <span className="mr-1 text-label font-semibold text-ink">Part {p.part}</span>
              {p.numbers.map((n) => (
                <QuestionNavButton
                  key={n}
                  number={n}
                  answered={answered.has(n)}
                  flagged={flagged.has(n)}
                  current={n === current}
                  onSelect={onSelect}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label={vi.exam.previous}
          onClick={() => go(-1)}
          disabled={idx <= 0}
        >
          <ChevronLeft className="size-5" strokeWidth={2} aria-hidden />
        </Button>
        <Button size="icon" aria-label={vi.exam.next} onClick={() => go(1)} disabled={idx >= all.length - 1}>
          <ChevronRight className="size-5" strokeWidth={2} aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
