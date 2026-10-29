// design-system.md §6 "Card": borders first; a shadow only when the whole card is a link.
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const cardVariants = cva('rounded-2xl border p-6 lg:p-8', {
  variants: {
    variant: {
      rest: 'border-border bg-surface text-ink',
      interactive:
        'border-border bg-surface text-ink transition-shadow duration-[120ms] hover:border-border-control hover:shadow-sm cursor-pointer focus-visible:shadow-focus outline-none',
      selected: 'border-2 border-accent bg-surface text-ink',
      emphasis: 'border-accent bg-accent text-accent-foreground',
    },
  },
  defaultVariants: { variant: 'rest' },
});

export function Card({
  className,
  variant,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardLabel({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-label font-medium text-ink-muted', className)} {...props} />;
}
