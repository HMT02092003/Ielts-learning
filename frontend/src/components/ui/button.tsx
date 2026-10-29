// shadcn/ui Button pattern (MIT), restyled to design-system.md §6 "Button".
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-[120ms] focus-visible:shadow-focus outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-foreground hover:bg-accent-hover disabled:bg-surface-muted disabled:text-ink-subtle',
        secondary:
          'border border-border-control bg-surface text-ink hover:border-border-strong hover:bg-background active:bg-surface-muted disabled:border-border disabled:text-ink-subtle',
        ghost: 'bg-transparent text-accent hover:bg-accent-soft disabled:text-ink-subtle',
        danger:
          'bg-danger text-white hover:bg-danger-hover disabled:bg-surface-muted disabled:text-ink-subtle',
        inverse: 'bg-accent-foreground text-accent hover:bg-accent-soft',
      },
      size: {
        sm: 'h-8 px-3 text-label-sm',
        md: 'h-10 px-4 text-body',
        touch: 'h-11 px-4 text-body',
        lg: 'h-12 px-5 text-title-sm',
        xl: 'h-[52px] px-5 text-title-sm',
        icon: 'size-10 lg:size-10 max-lg:size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    loadingText?: string;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  loadingText,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      aria-busy={loading || undefined}
      disabled={loading ?? props.disabled}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
