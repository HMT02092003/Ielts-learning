'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AnswerEditor } from '@/components/admin/answer-editor';
import { issuesOf, JsonEditor, type Issue } from '@/components/admin/json-editor';
import { StatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardLabel } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { viAdmin } from '@/i18n/vi-admin';
import { vi } from '@/i18n/vi';
import { ApiError } from '@/lib/api-client';
import { exportUrl, testsAdminApi, type AdminQuestion, type TestDetail } from '@/services/admin.service';
import { TestSource, type TestType } from '@/shared/enums';

const t = viAdmin.tests;
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Có lỗi xảy ra');

export default function AdminTestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useQuery({ queryKey: ['admin', 'test', id], queryFn: () => testsAdminApi.get(id) });
  if (detail.isPending) return <p className="text-ink-muted">{vi.common.loading}</p>;
  if (!detail.data) return <p className="text-danger">{errMsg(detail.error)}</p>;
  // Re-mount (fresh local state) whenever the server data changes.
  return <TestEditor key={detail.dataUpdatedAt} id={id} data={detail.data} />;
}

function TestEditor({ id, data }: { id: string; data: TestDetail }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [json, setJson] = useState(() => JSON.stringify(data.doc, null, 2));
  const [issues, setIssues] = useState<Issue[]>(data.publishIssues);
  const questions = useQuery({
    queryKey: ['admin', 'test', id, 'questions'],
    queryFn: () => testsAdminApi.questions(id),
  });
  const parsed = useMemo(() => {
    try {
      return JSON.parse(json) as unknown;
    } catch {
      return undefined;
    }
  }, [json]);
  const hotfix = useMutation({
    mutationFn: ({ q, body }: { q: AdminQuestion; body: Parameters<typeof testsAdminApi.hotfix>[2] }) =>
      testsAdminApi.hotfix(id, q.id, body),
    onSuccess: () => {
      toast.success(t.saved);
      void qc.invalidateQueries({ queryKey: ['admin', 'test', id, 'questions'] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'test', id] });
    void qc.invalidateQueries({ queryKey: ['admin', 'tests'] });
  };
  const onError = (e: unknown) => {
    const list = issuesOf(e);
    if (list.length) setIssues(list);
    toast.error(errMsg(e));
  };

  const saveMeta = useMutation({
    mutationFn: (body: Parameters<typeof testsAdminApi.updateMeta>[1]) => testsAdminApi.updateMeta(id, body),
    onSuccess: () => {
      toast.success(t.saved);
      refresh();
    },
    onError,
  });
  const saveContent = useMutation({
    mutationFn: (doc: unknown) => testsAdminApi.replaceContent(id, doc),
    onSuccess: () => {
      toast.success(t.saved);
      refresh();
    },
    onError,
  });
  const action = useMutation({
    mutationFn: async (kind: 'publish' | 'unpublish' | 'clone' | 'remove') => {
      if (kind === 'clone') return (await testsAdminApi.clone(id)).testId;
      if (kind === 'remove') return void (await testsAdminApi.remove(id));
      await testsAdminApi[kind](id);
      return undefined;
    },
    onSuccess: (newId, kind) => {
      if (kind === 'remove') router.replace('/admin/tests');
      else if (kind === 'clone' && newId) router.push(`/admin/tests/${newId}`);
      else {
        toast.success(kind === 'publish' ? t.published : t.saved);
        refresh();
      }
    },
    onError,
  });

  const test = data.test;
  const editable = test.status === 'DRAFT' && test.attemptCount === 0;

  function onMetaSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const num = (k: string) => (d.get(k) ? Number(d.get(k)) : null);
    saveMeta.mutate({
      title: String(d.get('title')),
      source: d.get('source') as (typeof TestSource.options)[number],
      type: d.get('type') as (typeof TestType.options)[number],
      sourceRef: String(d.get('sourceRef') ?? '') || null,
      bookNumber: num('bookNumber'),
      testNumber: num('testNumber'),
    });
  }

  function parseJson(): unknown {
    try {
      return JSON.parse(json);
    } catch (e) {
      setIssues([{ path: '', message: `${t.jsonInvalid}: ${(e as Error).message}` }]);
      return undefined;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-h2 font-light">{test.title}</h1>
          <div className="flex items-center gap-2 text-body text-ink-muted">
            <StatusBadge status={test.status} />
            <span>
              {test.seriesKey} · {t.version(test.version)} · {t.attempts(test.attemptCount)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {test.status !== 'PUBLISHED' && (
            <Button loading={action.isPending} onClick={() => action.mutate('publish')}>
              {t.publish}
            </Button>
          )}
          {test.status === 'PUBLISHED' && (
            <Button variant="secondary" onClick={() => action.mutate('unpublish')}>
              {t.unpublish}
            </Button>
          )}
          <Button variant="secondary" asChild>
            <a href={exportUrl.test(test.id)} download>
              {t.exportZip}
            </a>
          </Button>
          <Button variant="secondary" onClick={() => action.mutate('clone')}>
            {t.clone}
          </Button>
          {test.attemptCount === 0 && (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(t.confirmRemove)) action.mutate('remove');
              }}
            >
              {t.remove}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardLabel>{t.meta}</CardLabel>
        <form onSubmit={onMetaSubmit} className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="m-title">{t.colTitle}</Label>
            <Input id="m-title" name="title" defaultValue={test.title} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-ref">Nguồn (ghi chú)</Label>
            <Input id="m-ref" name="sourceRef" defaultValue={test.sourceRef ?? ''} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-source">{t.colSource}</Label>
            <NativeSelect id="m-source" name="source" defaultValue={test.source}>
              {TestSource.options.map((s) => (
                <option key={s} value={s}>
                  {viAdmin.source[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-type">Loại</Label>
            <NativeSelect id="m-type" name="type" defaultValue={test.type}>
              <option value="ACADEMIC">Academic</option>
              <option value="GENERAL">General Training</option>
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-book">Cuốn</Label>
              <Input
                id="m-book"
                name="bookNumber"
                type="number"
                min={1}
                defaultValue={test.bookNumber ?? ''}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-test">Test</Label>
              <Input
                id="m-test"
                name="testNumber"
                type="number"
                min={1}
                defaultValue={test.testNumber ?? ''}
              />
            </div>
          </div>
          <div className="md:col-span-3">
            <Button type="submit" variant="secondary" loading={saveMeta.isPending}>
              Lưu thông tin
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardLabel>{t.answers}</CardLabel>
          <span className={issues.length ? 'text-body text-danger' : 'text-body text-success'}>
            {issues.length ? t.issues(issues.length) : t.noIssues}
          </span>
        </div>
        <p className="mt-1 mb-4 text-body text-ink-muted">{t.answersHelp}</p>
        <AnswerEditor
          doc={parsed}
          editable={editable}
          onChange={(doc) => setJson(JSON.stringify(doc, null, 2))}
          hotfix={
            editable
              ? undefined
              : {
                  questions: questions.data ?? [],
                  save: (q, body, done) => hotfix.mutate({ q, body }, { onSuccess: done }),
                  savingId: hotfix.isPending ? hotfix.variables.q.id : null,
                }
          }
        />
        {editable && (
          <div className="mt-4">
            <Button
              loading={saveContent.isPending}
              onClick={() => {
                const doc = parseJson();
                if (doc !== undefined) saveContent.mutate(doc);
              }}
            >
              {t.saveAnswers}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <details open={issues.length > 0 || undefined}>
          <summary className="cursor-pointer text-label font-medium text-ink-muted">{t.advancedJson}</summary>
          <p className="mt-3 mb-4 text-body text-ink-muted">{t.contentHelp}</p>
          <JsonEditor
            label={t.content}
            value={json}
            onChange={setJson}
            issues={issues}
            readOnly={!editable}
          />
          {editable && (
            <div className="mt-4">
              <Button
                loading={saveContent.isPending}
                onClick={() => {
                  const doc = parseJson();
                  if (doc !== undefined) saveContent.mutate(doc);
                }}
              >
                {t.saveJson}
              </Button>
            </div>
          )}
        </details>
      </Card>
    </div>
  );
}
