import { cn } from '@/lib/cn';
import { vi } from '@/i18n/vi';

/**
 * App logo (self-drawn, spec §3): four rising bars — the four IELTS skills — under an upward trend line,
 * i.e. "band going up". Colours come from tokens, so it follows light/dark automatically.
 * Keep in sync with the favicon src/app/icon.svg (same geometry, fixed colours).
 */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-7 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <g fill="var(--accent-foreground)">
        <rect x="6" y="20" width="3.5" height="5" rx="1" />
        <rect x="11.5" y="17" width="3.5" height="8" rx="1" />
        <rect x="17" y="14" width="3.5" height="11" rx="1" />
        <rect x="22.5" y="11" width="3.5" height="14" rx="1" />
      </g>
      <g
        fill="none"
        stroke="var(--accent-foreground)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 14.5 L25.5 5" />
        <path d="M21 4.5 L25.5 5 L24 9.2" />
      </g>
    </svg>
  );
}

/** Logo + name (+ tagline on the large variant). Used in the Study shell header and the login page. */
export function BrandMark({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-ink', className)}>
      <LogoIcon className={size === 'lg' ? 'size-9' : 'size-7'} />
      <span className="flex flex-col leading-none">
        <span
          className={cn('font-display font-normal', size === 'lg' ? 'text-[1.375rem]' : 'text-[1.125rem]')}
        >
          {vi.app.name}
        </span>
        {size === 'lg' && <span className="mt-1 text-caption text-ink-muted">{vi.app.tagline}</span>}
      </span>
    </span>
  );
}
