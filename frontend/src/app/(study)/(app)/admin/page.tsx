'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardLabel } from '@/components/ui/card';
import { vi } from '@/i18n/vi';
import { queryKeys } from '@/lib/query-keys';
import { adminService } from '@/services/auth.service';

export default function AdminPage() {
  const overview = useQuery({ queryKey: queryKeys.adminOverview, queryFn: adminService.overview });
  const stats = [
    { label: vi.admin.users, value: overview.data?.users },
    { label: vi.admin.activeUsers, value: overview.data?.activeUsers },
    { label: vi.admin.tests, value: overview.data?.tests },
    { label: vi.admin.publishedTests, value: overview.data?.publishedTests },
  ];
  return (
    <div className="flex flex-col gap-6 pt-8">
      <h1 className="font-display text-h2 font-light text-ink">{vi.admin.title}</h1>
      <div className="flex flex-wrap gap-6">
        {stats.map((s) => (
          <Card key={s.label} className="flex-[1_1_200px]">
            <CardLabel>{s.label}</CardLabel>
            <p className="mt-2 font-display text-display-lg font-light font-tabular text-ink">
              {s.value ?? '–'}
            </p>
          </Card>
        ))}
      </div>
      <p className="text-body text-ink-muted">{vi.admin.comingSoon}</p>
    </div>
  );
}
