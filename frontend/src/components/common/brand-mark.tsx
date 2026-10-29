import { cn } from '@/lib/cn';
import { vi } from '@/i18n/vi';

/** "lặng" wordmark: accent dot + Lexend name (design: Login/Dashboard header). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display text-[1.125rem] text-ink', className)}>
      <span aria-hidden className="size-2.5 rounded-full bg-accent" />
      {vi.app.name}
    </span>
  );
}
