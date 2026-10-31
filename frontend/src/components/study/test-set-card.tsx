'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { SourceBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { setProgress } from '@/lib/test-sets';
import type { StudentTestSetDto } from '@/shared/test-sets';
import { TestCard, type Section } from './test-card';

type SetTest = StudentTestSetDto['tests'][number];

/** One book (e.g. Cambridge 18): collapsed shows progress; open shows each test with its skills. */
export function TestSetCard({
  set,
  defaultOpen = false,
  onPick,
}: {
  set: StudentTestSetDto;
  defaultOpen?: boolean;
  onPick: (test: SetTest, section: Section) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { total, done } = setProgress(set);
  return (
    <Card className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded-md text-left outline-none focus-visible:shadow-focus"
      >
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-display text-h3 text-accent"
        >
          {set.bookNumber ?? '•'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <SourceBadge source={set.source} />
            <span className="text-title-sm font-semibold">{set.title}</span>
          </span>
          <span className="text-label-sm text-ink-muted">
            {done}/{total} đề đã làm
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn('size-5 text-ink-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <ul className="grid gap-4 md:grid-cols-2">
          {set.tests.map((t) => (
            <li key={t.id}>
              <TestCard test={t} onPick={(s) => onPick(t, s)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
