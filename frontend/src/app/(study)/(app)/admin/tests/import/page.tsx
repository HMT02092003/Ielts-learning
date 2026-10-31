'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { issuesOf, type Issue } from '@/components/admin/json-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { viAdmin } from '@/i18n/vi-admin';
import { ApiError } from '@/lib/api-client';
import { testSetsAdminApi, testsAdminApi } from '@/services/admin.service';
import type { ImportResultDto } from '@/shared/admin';
import type { ZipImportResultDto } from '@/shared/test-sets';

const t = viAdmin.import;
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Có lỗi xảy ra');

/** "Thêm Test" on a set card links here with ?source=&bookNumber=&testNumber= — shown as a hint for the JSON. */
function SetHint() {
  const sp = useSearchParams();
  const source = sp.get('source');
  if (!source) return null;
  return (
    <p className="rounded-lg bg-accent-soft p-3 text-body text-accent">
      {t.setHint(source, sp.get('bookNumber') ?? 'null', sp.get('testNumber') ?? 'null')}
    </p>
  );
}

function ZipResult({ result, dryRun }: { result: ZipImportResultDto; dryRun: boolean }) {
  const qc = useQueryClient();
  const okIds = result.items.flatMap((i) => (i.ok && i.testId ? [i.testId] : []));
  const publish = useMutation({
    mutationFn: async () => {
      for (const id of okIds) await testsAdminApi.publish(id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success(t.published(okIds.length));
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const ok = result.items.filter((i) => i.ok).length;
  return (
    <Card className="flex flex-col gap-3">
      <p className="font-medium">{t.zipResult(ok, result.items.length)}</p>
      <ul className="flex flex-col gap-2">
        {result.items.map((i) => (
          <li key={i.file} className="flex flex-col gap-1 text-body">
            <span className={i.ok ? 'text-success' : 'text-danger'}>
              {i.ok ? '✓' : '✗'} {i.seriesKey ?? i.file}{' '}
              {i.testId && (
                <Link href={`/admin/tests/${i.testId}`} className="text-accent underline">
                  {t.openTest}
                </Link>
              )}
            </span>
            {i.issues?.map((is, n) => (
              <span key={n} className="pl-5 text-caption text-danger">
                <code className="font-mono">{is.path || '(gốc)'}</code> — {is.message}
              </span>
            ))}
          </li>
        ))}
      </ul>
      {!dryRun && okIds.length > 0 && (
        <Button className="self-start" loading={publish.isPending} onClick={() => publish.mutate()}>
          {t.publishValid}
        </Button>
      )}
    </Card>
  );
}

export default function AdminImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResultDto | null>(null);
  const [zipResult, setZipResult] = useState<{ result: ZipImportResultDto; dryRun: boolean } | null>(null);
  const zip = files.length === 1 && files[0]?.name.toLowerCase().endsWith('.zip') ? files[0] : null;

  const run = useMutation({
    mutationFn: async (dryRun: boolean) => {
      if (zip) setZipResult({ result: await testSetsAdminApi.importZip(zip, dryRun), dryRun });
      else setResult(await testsAdminApi.importFiles(files, dryRun));
    },
    onMutate: () => {
      setIssues([]);
      setError(null);
      setResult(null);
      setZipResult(null);
    },
    onError: (e) => {
      setIssues(issuesOf(e));
      setError(errMsg(e));
    },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="font-display text-h2 font-light">{t.title}</h1>
      <p className="text-body text-ink-muted">{t.help}</p>
      <Suspense>
        <SetHint />
      </Suspense>
      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-label font-medium">
          {t.choose}
          <input
            type="file"
            multiple
            accept=".json,.zip,application/zip,image/png,image/jpeg,image/webp,audio/*"
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
      {zipResult && <ZipResult result={zipResult.result} dryRun={zipResult.dryRun} />}
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
