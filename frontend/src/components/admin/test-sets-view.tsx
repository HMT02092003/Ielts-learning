'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/admin/status-badge';
import { SourceBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { viAdmin } from '@/i18n/vi-admin';
import { ApiError } from '@/lib/api-client';
import { nextTestNumber, skillMatrix, SKILLS } from '@/lib/test-sets';
import { exportUrl, qs, testSetsAdminApi } from '@/services/admin.service';
import type { TestSource } from '@/shared/enums';
import type { AdminTestSetDto } from '@/shared/test-sets';

const t = viAdmin.tests;

function SetCard({ set }: { set: AdminTestSetDto }) {
  const router = useRouter();
  const qc = useQueryClient();
  const publish = useMutation({
    mutationFn: () => testSetsAdminApi.publish(set.setKey),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      if (r.published.length) toast.success(t.setPublished(r.published.length));
      else if (!r.skipped.length) toast.info(t.setNothing);
      for (const s of r.skipped) toast.warning(t.setSkipped(s.seriesKey, s.reason));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Có lỗi xảy ra'),
  });
  const addHref = `/admin/tests/import${qs({
    source: set.source,
    bookNumber: set.bookNumber ?? undefined,
    testNumber: nextTestNumber(set),
  })}`;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <SourceBadge source={set.source} />
            <h2 className="font-display text-h3 font-normal">{set.title}</h2>
          </div>
          <p className="text-caption text-ink-muted">{t.setCounts(set.counts.draft, set.counts.published)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" asChild>
            <a href={exportUrl.set(set.setKey)} download>
              {t.exportSet}
            </a>
          </Button>
          <Button variant="secondary" size="sm" loading={publish.isPending} onClick={() => publish.mutate()}>
            {t.publishSet}
          </Button>
          <Button size="sm" asChild>
            <Link href={addHref}>{t.addTest}</Link>
          </Button>
        </div>
      </div>
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-divider text-left text-caption text-ink-muted">
            <th className="py-2 font-medium">{t.colTest}</th>
            {SKILLS.map((s) => (
              <th key={s} className="w-12 py-2 text-center font-medium" title={viAdmin.skill[s]}>
                {viAdmin.skill[s].charAt(0)}
              </th>
            ))}
            <th className="w-32 py-2 font-medium">{t.colStatus}</th>
          </tr>
        </thead>
        <tbody>
          {skillMatrix(set).map((row) => (
            <tr
              key={row.seriesKey}
              className="cursor-pointer border-b border-divider last:border-0 hover:bg-surface-muted"
              onClick={() => router.push(`/admin/tests/${row.id}`)}
            >
              <td className="py-2">
                <span className="font-medium">{row.title}</span>
                <span className="block text-caption text-ink-muted">{row.seriesKey}</span>
              </td>
              {SKILLS.map((s) => (
                <td key={s} className="py-2 text-center">
                  {row.skills[s] ? (
                    <Check className="mx-auto size-4 text-success" aria-label={viAdmin.skill[s]} />
                  ) : (
                    <span className="text-ink-subtle" aria-hidden>
                      –
                    </span>
                  )}
                </td>
              ))}
              <td className="py-2">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function TestSetsView({ q, source }: { q: string; source: TestSource | '' }) {
  const sets = useQuery({
    queryKey: ['admin', 'test-sets', q, source],
    queryFn: () => testSetsAdminApi.list({ q: q || undefined, source: source || undefined }),
  });
  if (sets.isPending) return <p className="text-body text-ink-muted">Đang tải…</p>;
  if (!sets.data?.length) return <p className="text-body text-ink-muted">{t.setsEmpty}</p>;
  return (
    <div className="flex flex-col gap-4">
      {sets.data.map((s) => (
        <SetCard key={s.setKey} set={s} />
      ))}
    </div>
  );
}
