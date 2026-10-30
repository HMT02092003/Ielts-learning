'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StatusBadge } from '@/components/admin/status-badge';
import { Badge, SourceBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { viAdmin } from '@/i18n/vi-admin';
import { testsAdminApi } from '@/services/admin.service';
import type { TestSummaryDto } from '@/shared/admin';
import { Skill, TestSource, TestStatus } from '@/shared/enums';

const t = viAdmin.tests;

export default function AdminTestsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ q: '', source: '', status: '', skill: '' });
  const tests = useQuery({
    queryKey: ['admin', 'tests', page, filters],
    queryFn: () => testsAdminApi.list({ page, ...filters } as never),
    placeholderData: keepPreviousData,
  });
  const set = (k: keyof typeof filters) => (v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const columns: Column<TestSummaryDto>[] = [
    {
      header: t.colTitle,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.title}</span>
          <span className="text-caption text-ink-muted">
            {row.original.seriesKey} · {t.version(row.original.version)} ·{' '}
            {t.attempts(row.original.attemptCount)}
          </span>
        </div>
      ),
    },
    { header: t.colSource, cell: ({ row }) => <SourceBadge source={row.original.source} /> },
    {
      header: t.colSkills,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.sections.map((s) => (
            <Badge key={s.skill} variant="neutral">
              {viAdmin.skill[s.skill]}
              {s.questions ? ` · ${s.questions}` : ''}
            </Badge>
          ))}
        </div>
      ),
    },
    { header: t.colStatus, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      header: t.colUpdated,
      cell: ({ row }) => (
        <span className="text-ink-muted">{new Date(row.original.updatedAt).toLocaleDateString('vi-VN')}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h2 font-light">{t.title}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/admin/ocr">{t.importOcr}</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/tests/import">{t.importJson}</Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t.search}
          aria-label={t.search}
          value={filters.q}
          onChange={(e) => set('q')(e.target.value)}
          className="max-w-xs"
        />
        <NativeSelect
          aria-label={t.colSource}
          value={filters.source}
          onChange={(e) => set('source')(e.target.value)}
        >
          <option value="">
            {t.colSource}: {t.all}
          </option>
          {TestSource.options.map((s) => (
            <option key={s} value={s}>
              {viAdmin.source[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t.colSkills}
          value={filters.skill}
          onChange={(e) => set('skill')(e.target.value)}
        >
          <option value="">
            {t.colSkills}: {t.all}
          </option>
          {Skill.options.map((s) => (
            <option key={s} value={s}>
              {viAdmin.skill[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t.colStatus}
          value={filters.status}
          onChange={(e) => set('status')(e.target.value)}
        >
          <option value="">
            {t.colStatus}: {t.all}
          </option>
          {TestStatus.options.map((s) => (
            <option key={s} value={s}>
              {viAdmin.status[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <DataTable
        columns={columns}
        data={tests.data?.items ?? []}
        total={tests.data?.total}
        page={page}
        pageSize={tests.data?.pageSize}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/admin/tests/${row.id}`)}
        loading={tests.isPending}
      />
    </div>
  );
}
