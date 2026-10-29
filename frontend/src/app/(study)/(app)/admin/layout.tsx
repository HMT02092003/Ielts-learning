'use client';

import type { ReactNode } from 'react';
import { NotFoundView } from '@/components/common/not-found-view';
import { useSession } from '@/hooks/use-session';
import { vi } from '@/i18n/vi';

/** UX guard only (the API returns 404 for non-admins anyway). Admin screens are always light. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useSession();
  if (isPending) return <p className="pt-8 text-body text-ink-muted">{vi.common.loading}</p>;
  if (user?.role !== 'ADMIN') return <NotFoundView />;
  return <div className="force-light rounded-2xl bg-background text-ink">{children}</div>;
}
