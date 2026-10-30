// Native <select> styled like the Input (admin forms and filters: native = best keyboard/mobile behaviour).
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <select
        data-slot="select"
        className="h-10 w-full appearance-none rounded-lg border border-border-strong bg-surface pr-9 pl-3 text-body text-ink outline-none transition-colors duration-[120ms] hover:border-ink-muted focus:border-accent focus:shadow-halo disabled:cursor-not-allowed disabled:bg-surface-muted"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
      />
    </span>
  );
}
