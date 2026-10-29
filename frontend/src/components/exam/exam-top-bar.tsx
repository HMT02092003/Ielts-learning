'use client';

import { HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { SourceBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';

export type ReadingSize = 'sm' | 'md' | 'lg';

/** Exam top bar (h60): left = source + title + candidate, centre = timer slot, right = A/A/A, help, submit. */
export function ExamTopBar({
  source,
  title,
  candidate,
  timer,
  readingSize,
  onReadingSize,
  onSubmit,
}: {
  source: 'CAM' | 'VOL' | 'PRE_IELTS' | 'CUSTOM';
  title: string;
  candidate: string;
  timer: ReactNode;
  readingSize: ReadingSize;
  onReadingSize: (s: ReadingSize) => void;
  onSubmit: () => void;
}) {
  const sizes: { value: ReadingSize; className: string }[] = [
    { value: 'sm', className: 'text-label-sm' },
    { value: 'md', className: 'text-body-lg' },
    { value: 'lg', className: 'text-[1.25rem]' },
  ];
  return (
    <header className="grid h-[60px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border bg-surface px-4">
      <div className="flex min-w-0 items-center gap-3">
        <SourceBadge source={source} />
        <span className="truncate text-body font-medium text-ink">{title}</span>
        <span className="hidden truncate text-body text-ink-muted lg:inline">· {candidate}</span>
      </div>
      <div className="justify-self-center">{timer}</div>
      <div className="flex items-center justify-self-end gap-2">
        <div
          role="radiogroup"
          aria-label={vi.exam.fontSize}
          className="flex rounded-lg bg-surface-muted p-0.5"
        >
          {sizes.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={readingSize === s.value}
              aria-label={`${vi.exam.fontSize} ${s.value}`}
              onClick={() => onReadingSize(s.value)}
              className={cn(
                'flex h-8 w-9 items-center justify-center rounded-md font-reading text-ink-muted outline-none focus-visible:shadow-focus',
                s.className,
                readingSize === s.value && 'bg-surface text-ink shadow-xs',
              )}
            >
              A
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" aria-label={vi.exam.help} className="text-ink-muted">
          <HelpCircle className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </Button>
        <Button onClick={onSubmit}>{vi.exam.submit}</Button>
      </div>
    </header>
  );
}

export function InstructionStrip({ children }: { children: ReactNode }) {
  return <div className="shrink-0 bg-background px-5 py-2.5 text-body text-ink">{children}</div>;
}
