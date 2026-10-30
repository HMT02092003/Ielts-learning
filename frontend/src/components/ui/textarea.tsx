// shadcn/ui Textarea pattern (MIT), restyled with design tokens (design-system.md §6 "Input / Textarea").
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-24 w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-body text-ink outline-none transition-colors duration-[120ms] placeholder:text-ink-subtle hover:border-ink-muted focus:border-accent focus:shadow-halo disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-danger aria-invalid:shadow-halo-danger',
        className,
      )}
      {...props}
    />
  );
}
