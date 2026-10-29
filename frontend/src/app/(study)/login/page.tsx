import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BrandMark } from '@/components/common/brand-mark';
import { ThemeMenu } from '@/components/layout/theme-menu';
import { vi } from '@/i18n/vi';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: vi.login.title };

function today() {
  const s = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** C-Login: no card; two-column welcome + form. Personal data is NOT shown before sign-in (decision M10). */
export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-dashboard items-center justify-between px-8 py-9">
        <BrandMark />
        <div className="flex items-center gap-3">
          <span className="text-label-sm text-ink-muted">{today()}</span>
          <ThemeMenu />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-8 pt-6 pb-16">
        <div className="flex w-full max-w-login flex-wrap items-center gap-24">
          <section className="flex flex-[1_1_380px] flex-col gap-7">
            <h1 className="font-display text-display-hero font-extralight text-ink">
              {vi.login.greeting}
              <br />
              <span className="text-ink-muted">{vi.login.subtitle}</span>
            </h1>
            <hr className="w-12 border-border-control" />
            <blockquote
              lang="en"
              className="max-w-[420px] font-reading text-[1.25rem] leading-normal italic text-ink-secondary"
            >
              {vi.login.quote}
            </blockquote>
          </section>
          <section className="flex-[1_1_360px]">
            <Suspense>
              <LoginForm />
            </Suspense>
          </section>
        </div>
      </main>
    </div>
  );
}
