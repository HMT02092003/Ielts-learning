import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { vi } from '@/i18n/vi';

export function NotFoundView() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-[520px] flex-col justify-center gap-4 px-6">
      <p className="font-display text-display-lg font-light text-ink-muted">404</p>
      <h1 className="text-h2 font-display font-light text-ink">{vi.common.notFoundTitle}</h1>
      <p className="text-body-lg text-ink-muted">{vi.common.notFoundBody}</p>
      <Link href="/dashboard" className={buttonVariants({ variant: 'secondary', className: 'self-start' })}>
        {vi.common.toHome}
      </Link>
    </div>
  );
}
