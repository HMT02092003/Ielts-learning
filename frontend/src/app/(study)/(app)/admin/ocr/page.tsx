'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { viAdmin } from '@/i18n/vi-admin';
import { ApiError } from '@/lib/api-client';
import { ocrApi } from '@/services/admin.service';
import type { OcrJobDto } from '@/shared/ocr';

const t = viAdmin.ocr;
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Có lỗi xảy ra');

const STATUS_VARIANT = {
  QUEUED: 'neutral',
  RUNNING: 'warning',
  NEEDS_REVIEW: 'warning',
  FAILED: 'danger',
  IMPORTED: 'success',
} as const;

export default function AdminOcrPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const jobs = useQuery({
    queryKey: ['admin', 'ocr', page],
    queryFn: () => ocrApi.list(page),
    placeholderData: keepPreviousData,
    // Poll while something is still processing.
    refetchInterval: (q) =>
      q.state.data?.items.some((j) => j.status === 'QUEUED' || j.status === 'RUNNING') ? 3000 : false,
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin', 'ocr'] });
  const upload = useMutation({
    mutationFn: () => ocrApi.create(files, title || undefined),
    onSuccess: () => {
      setFiles([]);
      setTitle('');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const retry = useMutation({
    mutationFn: ocrApi.retry,
    onSuccess: invalidate,
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: ocrApi.remove,
    onSuccess: invalidate,
    onError: (e) => toast.error(errMsg(e)),
  });

  const columns: Column<OcrJobDto>[] = [
    {
      header: 'Job',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.title ?? row.original.id.slice(0, 8)}</span>
          <span className="text-caption text-ink-muted">
            {new Date(row.original.createdAt).toLocaleString('vi-VN')}
            {row.original.pageCount ? ` · ${t.pages(row.original.pageCount)}` : ''}
          </span>
        </div>
      ),
    },
    {
      header: 'Trạng thái',
      cell: ({ row }) => (
        <div className="flex min-w-40 flex-col gap-1.5">
          <Badge variant={STATUS_VARIANT[row.original.status]}>{t.status[row.original.status]}</Badge>
          {row.original.status === 'RUNNING' && (
            <Progress value={Math.round(row.original.progress * 100)} aria-label="Tiến độ OCR" />
          )}
          {row.original.lastError && (
            <span className="text-caption text-danger">{row.original.lastError}</span>
          )}
        </div>
      ),
    },
    {
      header: t.confidence,
      cell: ({ row }) =>
        row.original.meanConfidence === null ? '—' : `${Math.round(row.original.meanConfidence)}%`,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {row.original.status === 'FAILED' && (
            <Button variant="secondary" size="sm" onClick={() => retry.mutate(row.original.id)}>
              {t.retry}
            </Button>
          )}
          {(row.original.status === 'NEEDS_REVIEW' || row.original.status === 'IMPORTED') && (
            <Button size="sm" onClick={() => router.push(`/admin/ocr/${row.original.id}`)}>
              {t.review}
            </Button>
          )}
          {row.original.status !== 'RUNNING' && (
            <Button variant="ghost" size="sm" onClick={() => remove.mutate(row.original.id)}>
              {t.remove}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-h2 font-light">{t.title}</h1>
      <p className="max-w-3xl text-body text-ink-muted">{t.help}</p>
      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ocr-files">File (PDF hoặc ảnh)</Label>
            <input
              id="ocr-files"
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="text-body file:mr-3 file:rounded-lg file:border file:border-border-control file:bg-surface file:px-3 file:py-2 file:text-ink"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ocr-title">{t.jobTitle}</Label>
            <Input id="ocr-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
        <Button
          className="self-start"
          disabled={!files.length}
          loading={upload.isPending}
          onClick={() => upload.mutate()}
        >
          {t.upload}
        </Button>
      </Card>
      <DataTable
        columns={columns}
        data={jobs.data?.items ?? []}
        total={jobs.data?.total}
        page={page}
        pageSize={jobs.data?.pageSize}
        onPageChange={setPage}
        loading={jobs.isPending}
      />
    </div>
  );
}
