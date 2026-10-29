// design-system.md §6 "Tag": h24, px8, radius-sm, 12px/600. Colour is never the only cue — always a text label.
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const badgeVariants = cva(
  'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-sm px-2 text-caption font-semibold',
  {
    variants: {
      variant: {
        'source-cam': 'bg-accent text-accent-foreground',
        'source-vol': 'bg-accent-soft text-accent',
        'source-pre': 'border border-border-control bg-surface text-ink-secondary',
        neutral: 'bg-surface-muted text-ink',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning-ink',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        'mode-exam': 'bg-ink text-ink-inverse',
        'mode-practice': 'bg-accent-soft text-accent',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** CAM / VOL / Pre-IELTS / custom source tag. */
export function SourceBadge({ source }: { source: 'CAM' | 'VOL' | 'PRE_IELTS' | 'CUSTOM' }) {
  const map = {
    CAM: { variant: 'source-cam', label: 'CAM' },
    VOL: { variant: 'source-vol', label: 'VOL' },
    PRE_IELTS: { variant: 'source-pre', label: 'Pre-IELTS' },
    CUSTOM: { variant: 'neutral', label: 'Mẫu' },
  } as const;
  const { variant, label } = map[source];
  return <Badge variant={variant}>{label}</Badge>;
}
