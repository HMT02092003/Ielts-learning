'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { issuesOf, type Issue } from '@/components/admin/json-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { viAdmin } from '@/i18n/vi-admin';
import { ApiError } from '@/lib/api-client';
import { testsAdminApi } from '@/services/admin.service';
import type { ImportResultDto } from '@/shared/admin';

const t = viAdmin.import;

export default function AdminImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResultDto | null>(null);

  const run = useMutation({
    mutationFn: (dryRun: boolean) => testsAdminApi.importFiles(files, dryRun),
    onMutate: () => {
      setIssues([]);
      setError(null);
      setResult(null);
    },
    onSuccess: setResult,
    onError: (e) => {
      setIssues(issuesOf(e));
      setError(e instanceof ApiError ? e.message : 'Có lỗi xảy ra');
    },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="font-display text-h2 font-light">{t.title}</h1>
      <p className="text-body text-ink-muted">{t.help}</p>
      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-label font-medium">
          {t.choose}
          <input
            type="file"
            multiple
            accept=".json,image/png,image/jpeg,image/webp,audio/*"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-body file:mr-3 file:rounded-lg file:border file:border-border-control file:bg-surface file:px-3 file:py-2 file:text-ink"
          />
        </label>
        {files.length > 0 && (
          <ul className="text-body text-ink-muted">
            {files.map((f) => (
              <li key={f.name}>
                {f.name} · {Math.ceil(f.size / 1024)} KB
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!files.length}
            loading={run.isPending && run.variables}
            onClick={() => run.mutate(true)}
          >
            {t.dryRun}
          </Button>
          <Button
            disabled={!files.length}
            loading={run.isPending && !run.variables}
            onClick={() => run.mutate(false)}
          >
            {t.run}
          </Button>
        </div>
      </Card>
      {result && (
        <Card className="flex flex-col gap-2 border-success">
          <p className="font-medium text-success">{result.testId ? t.done : t.valid}</p>
          <ul className="text-body">
            {result.summary?.sections.map((s) => (
              <li key={s.skill}>
                {viAdmin.skill[s.skill]}: {s.parts} phần, {s.questions} câu
              </li>
            ))}
          </ul>
          {result.testId && (
            <Button asChild className="self-start">
              <Link href={`/admin/tests/${result.testId}`}>{t.openTest}</Link>
            </Button>
          )}
        </Card>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-danger-border bg-danger-soft p-4"
        >
          <p className="font-medium text-danger">{error}</p>
          <ul className="flex flex-col gap-1">
            {issues.map((i, n) => (
              <li key={n} className="text-body text-danger">
                <code className="font-mono text-caption">{i.path || '(gốc)'}</code> — {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
