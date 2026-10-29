import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { vi } from '@/i18n/vi';
import { parseTheme, THEME_BOOT_SCRIPT, THEME_COOKIE } from '@/lib/theme';
import { fontVariables } from '@/styles/fonts';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { default: `${vi.app.name} · ${vi.app.tagline}`, template: `%s · ${vi.app.name}` },
  description: 'Luyện thi IELTS nội bộ',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="vi" className={`${fontVariables}${theme === 'dark' ? ' dark' : ''}`} suppressHydrationWarning>
      <head>
        {/* Resolve "system" theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
