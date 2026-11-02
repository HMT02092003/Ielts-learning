'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { TestBuilder } from '@/components/admin/builder/test-builder';
import { vi } from '@/i18n/vi';
import { ApiError } from '@/lib/api-client';
import type { Doc } from '@/lib/builder/types';
import { testsAdminApi } from '@/services/admin.service';

export default function TestBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useQuery({ queryKey: ['admin', 'test', id], queryFn: () => testsAdminApi.get(id) });
  if (detail.isPending) return <p className="text-ink-muted">{vi.common.loading}</p>;
  if (!detail.data)
    return (
      <p className="text-danger">
        {detail.error instanceof ApiError ? detail.error.message : 'Có lỗi xảy ra'}
      </p>
    );
  return <TestBuilder key={id} testId={id} initialDoc={detail.data.doc as Doc} test={detail.data.test} />;
}
