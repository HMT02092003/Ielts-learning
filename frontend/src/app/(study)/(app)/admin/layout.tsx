'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { NotFoundView } from '@/components/common/not-found-view';
import { useSession } from '@/hooks/use-session';
import { vi } from '@/i18n/vi';
import { viAdmin } from '@/i18n/vi-admin';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/admin', label: viAdmin.nav.overview, exact: true },
  { href: '/admin/users', label: viAdmin.nav.users },
  { href: '/admin/tests', label: viAdmin.nav.tests },
  { href: '/admin/ocr', label: viAdmin.nav.ocr },
  { href: '/admin/band-tables', label: viAdmin.nav.bandTables },
  { href: '/admin/grading', label: viAdmin.nav.grading },
];

/** UX guard only (the API returns 404 for non-admins anyway). Admin screens are always light. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useSession();
  const pathname = usePathname();
  if (isPending) return <p className="pt-8 text-body text-ink-muted">{vi.common.loading}</p>;
  if (user?.role !== 'ADMIN') return <NotFoundView />;
  return (
    <div className="force-light flex flex-col gap-6 pt-4 text-ink">
      <nav aria-label="Quản trị" className="flex flex-wrap gap-1 border-b border-border pb-2">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-9 items-center rounded-md px-3 text-body outline-none focus-visible:shadow-focus',
                active ? 'bg-accent-soft font-medium text-accent' : 'text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
