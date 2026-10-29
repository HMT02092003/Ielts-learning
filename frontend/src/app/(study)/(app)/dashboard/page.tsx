'use client';

import { LayoutDashboard, MonitorPlay } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSession } from '@/hooks/use-session';
import { vi } from '@/i18n/vi';

/** Phase 1: empty Study shell page. The bento dashboard (C-Dashboard) arrives in Phase 6. */
export default function DashboardPage() {
  const { data: user } = useSession();
  return (
    <div className="flex flex-col gap-8 pt-8">
      <h1 className="font-display text-h1 font-extralight text-ink">
        {user ? vi.dashboard.hello(user.displayName) : ' '}
      </h1>
      <Card>
        <EmptyState
          icon={<LayoutDashboard strokeWidth={1.75} aria-hidden />}
          title={vi.dashboard.emptyTitle}
          body={vi.dashboard.emptyBody}
          action={
            <Link href="/preview" className={buttonVariants({ variant: 'secondary' })}>
              <MonitorPlay className="size-4" strokeWidth={1.75} aria-hidden />
              {vi.dashboard.previewExam}
            </Link>
          }
        />
      </Card>
    </div>
  );
}
