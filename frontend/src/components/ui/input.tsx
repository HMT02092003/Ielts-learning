// shadcn/ui Input pattern (MIT), restyled to design-system.md §6 "Input".
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const inputVariants = cva(
  'w-full min-w-0 rounded-lg border border-border-strong bg-surface px-3.5 text-ink outline-none transition-colors duration-[120ms] placeholder:text-ink-subtle hover:border-ink-muted focus:border-accent focus:shadow-halo focus-visible:shadow-focus disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-ink-subtle aria-invalid:border-danger aria-invalid:shadow-halo-danger read-only:border-transparent read-only:bg-surface-muted',
  {
    variants: {
      size: {
        md: 'h-11 text-body-lg',
        lg: 'h-[52px] px-4 text-body-lg',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export function Input({
  className,
  size,
  ...props
}: Omit<ComponentProps<'input'>, 'size'> & VariantProps<typeof inputVariants>) {
  return <input data-slot="input" className={cn(inputVariants({ size }), className)} {...props} />;
}
