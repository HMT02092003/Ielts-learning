'use client';

// design-system.md §6 "Progress bar" + optional target marker. Always labelled for assistive tech.
import { Progress as ProgressPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const fills = {
  default: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  'on-accent': 'bg-accent-foreground',
} as const;

type ProgressProps = ComponentProps<typeof ProgressPrimitive.Root> & {
  value: number;
  tone?: keyof typeof fills;
  large?: boolean;
  /** 0–100: draws a 1px ink tick (e.g. target band). */
  targetMarker?: number;
};

export function Progress({
  className,
  value,
  tone = 'default',
  large,
  targetMarker,
  ...props
}: ProgressProps) {
  return (
    <div className="relative">
      <ProgressPrimitive.Root
        data-slot="progress"
        value={value}
        className={cn(
          'relative w-full overflow-hidden rounded-full',
          tone === 'on-accent' ? 'bg-on-accent-track' : 'bg-surface-muted',
          large ? 'h-2' : 'h-1',
          className,
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn('h-full rounded-full transition-[width] duration-[400ms] ease-out', fills[tone])}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </ProgressPrimitive.Root>
      {targetMarker !== undefined && (
        <span
          aria-hidden
          className="absolute -top-[5px] h-3.5 w-px bg-ink"
          style={{ left: `${Math.max(0, Math.min(100, targetMarker))}%` }}
        />
      )}
    </div>
  );
}
