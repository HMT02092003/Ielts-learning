'use client';

// Test builder shell: outline | editor | preview & issues. Edits a TestImportDoc in memory, validates it live with
// the shared schema, keeps an unsaved copy in localStorage, and saves through the existing admin API
// (new → import, draft → replace content). Published tests open read-only (clone to change them).
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Braces,
  CheckCircle2,
  Eye,
  EyeOff,
  LayoutList,
  Save,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { issuesOf, JsonEditor } from '@/components/admin/json-editor';
import { StatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { renumberDoc } from '@/lib/builder/numbering';
import type { Doc, Selection } from '@/lib/builder/types';
import { humanPath, validateDoc, type BuilderIssue } from '@/lib/builder/validate';
import { testsAdminApi } from '@/services/admin.service';
import type { TestSummaryDto } from '@/shared/admin';
import { zodIssues } from '@/shared/errors';
import { WorkingDoc } from '@/shared/test-import';
import { BuilderProvider } from './context';
import { GroupEditor } from './group-editor';
import { MetaEditor } from './meta-editor';
import { Outline } from './outline';
import { Preview } from './preview';
import { ListeningPartEditor, PassageEditor } from './section-editors';
import { SpeakingEditor, WritingEditor } from './writing-speaking';

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Có lỗi xảy ra');

interface LocalDraft {
  doc: Doc;
  at: number;
  /** updatedAt of the server version the draft started from ('' for a new test). */
  base: string;
}

function readLocal(key: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, v: LocalDraft | null) {
  try {
    if (v) window.localStorage.setItem(key, JSON.stringify(v));
    else window.localStorage.removeItem(key);
  } catch {
    /* storage blocked: the builder still works, just without the safety copy */
  }
}

/** Issue path → the outline node that owns it. */
function selectionFor(path: string): Selection {
  const n = (re: RegExp) => {
    const m = re.exec(path);
    return m ? Number(m[1]) : null;
  };
  const p = n(/^reading\.passages\[(\d+)\]/);
  const l = n(/^listening\.parts\[(\d+)\]/);
  const g = n(/\.groups\[(\d+)\]/);
  if (p !== null)
    return g !== null ? { kind: 'group', skill: 'reading', i: p, g } : { kind: 'passage', i: p };
  if (l !== null)
    return g !== null ? { kind: 'group', skill: 'listening', i: l, g } : { kind: 'lpart', i: l };
  if (path.startsWith('reading')) return { kind: 'passage', i: 0 };
  if (path.startsWith('listening')) return { kind: 'lpart', i: 0 };
  const w = n(/^writing\.tasks\[(\d+)\]/);
  if (w !== null || path.startsWith('writing')) return { kind: 'writing', i: w ?? 0 };
  const s = n(/^speaking\.parts\[(\d+)\]/);
  if (s !== null || path.startsWith('speaking')) return { kind: 'speaking', i: s ?? 0 };
  return { kind: 'meta' };
}

function normalize(doc: Doc): Doc {
  const d = structuredClone(doc);
  renumberDoc(d);
  return d;
}

export function TestBuilder({
  testId,
  initialDoc,
  test,
}: {
  testId?: string;
  initialDoc: Doc;
  test?: TestSummaryDto;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const isNew = !testId;
  const readOnly = Boolean(test && (test.status !== 'DRAFT' || test.attemptCount > 0));
  const storageKey = `bandup:builder:${testId ?? 'new'}`;
  const base = test?.updatedAt ?? '';

  const [doc, setDocState] = useState<Doc>(() => normalize(initialDoc));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(normalize(initialDoc)));
  const [sel, setSel] = useState<Selection>({ kind: 'meta' });
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [rightTab, setRightTab] = useState<'preview' | 'issues'>('preview');
  const [showRight, setShowRight] = useState(true);
  const [serverIssues, setServerIssues] = useState<BuilderIssue[]>([]);
  const [restore, setRestore] = useState<LocalDraft | null>(null);
  /** The server holds an unfinished working document (content tables not updated yet). */
  const [hasWorking, setHasWorking] = useState(Boolean(test?.workingDocAt));

  const json = useMemo(() => JSON.stringify(doc), [doc]);
  const dirty = json !== savedJson;
  const validation = useMemo(() => validateDoc(doc), [doc]);
  const issues = useMemo(() => [...serverIssues, ...validation.issues], [serverIssues, validation.issues]);

  const setDoc = useCallback((d: Doc) => {
    setDocState(d);
    setServerIssues([]);
  }, []);

  // Offer to restore an unsaved local copy (same server version only).
  useEffect(() => {
    if (readOnly) return;
    const local = readLocal(storageKey);
    if (local && local.base === base && JSON.stringify(local.doc) !== JSON.stringify(normalize(initialDoc))) {
      setRestore(local); // eslint-disable-line react-hooks/set-state-in-effect -- reading browser storage after mount
    }
  }, [storageKey, base, readOnly, initialDoc]);

  // Keep a local safety copy while editing.
  useEffect(() => {
    if (readOnly || !dirty || restore) return;
    const t = window.setTimeout(() => writeLocal(storageKey, { doc, at: Date.now(), base }), 600);
    return () => window.clearTimeout(t);
  }, [doc, dirty, readOnly, restore, storageKey, base]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, readOnly]);

  const onSaveError = (e: unknown) => {
    const list = issuesOf(e).map((i) => ({ path: i.path, message: i.message, level: 'draft' as const }));
    if (list.length) {
      setServerIssues(list);
      setRightTab('issues');
      setShowRight(true);
    }
    toast.error(errMsg(e));
  };

  const save = useMutation({
    /** Complete documents go into the test; unfinished ones are kept as the working document. */
    mutationFn: async (current: Doc) => {
      const v = validateDoc(current);
      if (v.canSave) {
        if (isNew) {
          const file = new File([JSON.stringify(current, null, 2)], `${current.seriesKey || 'test'}.json`, {
            type: 'application/json',
          });
          const res = await testsAdminApi.importFiles([file], false);
          return { id: res.testId, working: false, missing: 0 };
        }
        await testsAdminApi.replaceContent(testId, current);
        return { id: testId, working: false, missing: 0 };
      }
      if (isNew) {
        const res = await testsAdminApi.createWorking(current);
        return { id: res.testId, working: true, missing: v.issues.length };
      }
      await testsAdminApi.saveWorking(testId, current);
      return { id: testId, working: true, missing: v.issues.length };
    },
    onSuccess: ({ id, working, missing }, current) => {
      writeLocal(storageKey, null);
      setSavedJson(JSON.stringify(current));
      setHasWorking(working);
      void qc.invalidateQueries({ queryKey: ['admin', 'tests'] });
      if (id) void qc.invalidateQueries({ queryKey: ['admin', 'test', id] });
      if (working) toast.success(`Đã lưu bản soạn dở — còn ${missing} mục chưa xong, chưa áp dụng vào đề`);
      else toast.success(hasWorking ? 'Đã áp dụng vào đề' : 'Đã lưu bản nháp');
      if (isNew && id) router.replace(`/admin/tests/${id}/builder`);
    },
    onError: onSaveError,
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!testId) return;
      if (dirty || hasWorking) await testsAdminApi.replaceContent(testId, doc);
      await testsAdminApi.publish(testId);
    },
    onSuccess: () => {
      writeLocal(storageKey, null);
      setSavedJson(json);
      void qc.invalidateQueries({ queryKey: ['admin', 'tests'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'test', testId] });
      toast.success('Đã xuất bản đề');
      router.push(`/admin/tests/${testId}`);
    },
    onError: onSaveError,
  });

  const clone = useMutation({
    mutationFn: () => testsAdminApi.clone(testId!),
    onSuccess: (res) => {
      toast.success('Đã tạo bản nháp mới');
      if (res.testId) router.push(`/admin/tests/${res.testId}/builder`);
    },
    onError: onSaveError,
  });

  const trySave = useCallback(() => {
    if (readOnly || save.isPending) return;
    if (mode === 'json')
      return toast.error('Chuyển về “Trình soạn” để lưu (hoặc sửa JSON cho hợp lệ trước).');
    if (!validation.canSave) {
      // Unfinished content can be saved as a working document, but the test row needs valid metadata.
      const meta = WorkingDoc.safeParse(doc);
      if (!meta.success) {
        setServerIssues(
          zodIssues(meta.error).map((i) => ({ path: i.path, message: i.message, level: 'draft' })),
        );
        setSel({ kind: 'meta' });
        return toast.error('Nhập tên đề và mã series hợp lệ trước khi lưu');
      }
    }
    save.mutate(doc);
  }, [doc, mode, readOnly, save, validation]);

  const discard = useMutation({
    mutationFn: async () => {
      await testsAdminApi.discardWorking(testId!);
      return testsAdminApi.get(testId!);
    },
    onSuccess: (detail) => {
      const fresh = normalize(detail.doc as Doc);
      writeLocal(storageKey, null);
      setDoc(fresh);
      setSavedJson(JSON.stringify(fresh));
      setHasWorking(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'tests'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'test', testId] });
      toast.success('Đã bỏ bản soạn dở, quay về nội dung đã lưu của đề');
    },
    onError: onSaveError,
  });

  // Ctrl/Cmd + S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        trySave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trySave]);

  function goToIssue(path: string) {
    setMode('form');
    setSel(selectionFor(path));
    const q = /\.questions\[(\d+)\]/.exec(path);
    const sec = selectionFor(path);
    if (q && sec.kind === 'group') {
      const list = sec.skill === 'reading' ? doc.reading?.passages : doc.listening?.parts;
      const number = list?.[sec.i]?.groups[sec.g]?.questions[Number(q[1])]?.number;
      if (number)
        window.setTimeout(
          () => document.getElementById(`builder-q-${number}`)?.scrollIntoView({ block: 'center' }),
          50,
        );
    }
  }

  function switchMode(next: 'form' | 'json') {
    if (next === mode) return;
    if (next === 'json') {
      setJsonText(JSON.stringify(doc, null, 2));
      setMode('json');
      return;
    }
    try {
      const parsed = JSON.parse(jsonText) as Doc;
      setDoc(normalize(parsed));
      setMode('form');
    } catch (e) {
      toast.error(`JSON không hợp lệ: ${(e as Error).message}`);
    }
  }

  let editor;
  switch (sel.kind) {
    case 'meta':
      editor = <MetaEditor isNew={isNew} />;
      break;
    case 'passage':
      editor = <PassageEditor i={sel.i} />;
      break;
    case 'lpart':
      editor = <ListeningPartEditor i={sel.i} />;
      break;
    case 'group':
      editor = <GroupEditor key={`${sel.skill}-${sel.i}-${sel.g}`} skill={sel.skill} i={sel.i} g={sel.g} />;
      break;
    case 'writing':
      editor = <WritingEditor i={sel.i} />;
      break;
    case 'speaking':
      editor = <SpeakingEditor i={sel.i} />;
      break;
  }

  const draftIssues = issues.filter((i) => i.level === 'draft').length;
  const status = validation.canPublish
    ? {
        icon: <CheckCircle2 className="size-4" aria-hidden />,
        text: 'Đủ điều kiện xuất bản',
        cls: 'text-success',
      }
    : validation.canSave
      ? {
          icon: <AlertTriangle className="size-4" aria-hidden />,
          text: `Lưu được nháp · ${issues.length} điều kiện xuất bản chưa đạt`,
          cls: 'text-warning-ink',
        }
      : {
          icon: <AlertTriangle className="size-4" aria-hidden />,
          text: `${draftIssues} mục chưa xong · lưu được dạng bản soạn dở`,
          cls: 'text-danger',
        };

  return (
    <BuilderProvider doc={doc} setDoc={setDoc} readOnly={readOnly} sel={sel} select={setSel} issues={issues}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              href={testId ? `/admin/tests/${testId}` : '/admin/tests'}
              className="flex w-fit items-center gap-1 text-label text-ink-muted hover:text-ink"
            >
              <ArrowLeft className="size-4" aria-hidden /> {testId ? 'Trang đề' : 'Danh sách đề'}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-h2 font-light">
                {doc.title || (isNew ? 'Soạn đề mới' : 'Đề chưa đặt tên')}
              </h1>
              {test && <StatusBadge status={test.status} />}
            </div>
            <button
              type="button"
              onClick={() => {
                setRightTab('issues');
                setShowRight(true);
              }}
              className={cn(
                'flex w-fit items-center gap-1.5 text-label outline-none focus-visible:shadow-focus',
                status.cls,
              )}
            >
              {status.icon} {status.text}
              {dirty && !readOnly && <span className="text-ink-subtle"> · chưa lưu</span>}
              {!dirty && hasWorking && (
                <span className="text-ink-subtle"> · đã lưu bản soạn dở (chưa áp dụng vào đề)</span>
              )}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Chế độ soạn"
              className="flex rounded-lg border border-border-control p-0.5"
            >
              {(
                [
                  ['form', 'Trình soạn', <LayoutList key="i" className="size-4" aria-hidden />],
                  ['json', 'JSON', <Braces key="i" className="size-4" aria-hidden />],
                ] as const
              ).map(([m, label, icon]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-md px-3 text-label outline-none focus-visible:shadow-focus',
                    mode === m ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowRight((v) => !v)}
              className="hidden xl:inline-flex"
            >
              {showRight ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {showRight ? 'Ẩn xem trước' : 'Xem trước'}
            </Button>
            {readOnly ? (
              testId && (
                <Button type="button" loading={clone.isPending} onClick={() => clone.mutate()}>
                  Nhân bản để sửa
                </Button>
              )
            ) : (
              <>
                {hasWorking && testId && (
                  <Button
                    type="button"
                    variant="ghost"
                    loading={discard.isPending}
                    onClick={() => {
                      if (window.confirm('Bỏ bản soạn dở và quay về nội dung đã lưu của đề?'))
                        discard.mutate();
                    }}
                  >
                    Bỏ bản soạn dở
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  loading={save.isPending}
                  onClick={trySave}
                  title="Ctrl + S"
                >
                  <Save className="size-4" aria-hidden /> {isNew ? 'Tạo bản nháp' : 'Lưu nháp'}
                </Button>
                {!isNew && (
                  <Button
                    type="button"
                    loading={publish.isPending}
                    disabled={!validation.canPublish || mode === 'json'}
                    title={validation.canPublish ? undefined : 'Sửa hết lỗi để xuất bản'}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Xuất bản đề? Sau khi xuất bản, nội dung không sửa trực tiếp được nữa (chỉ sửa nhanh đáp án).',
                        )
                      )
                        publish.mutate();
                    }}
                  >
                    <Send className="size-4" aria-hidden /> Xuất bản
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {readOnly && (
          <p className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-body text-ink-secondary">
            {test?.status === 'PUBLISHED'
              ? 'Đề đã xuất bản nên chỉ xem được. Muốn thay đổi nội dung, bấm “Nhân bản để sửa” để tạo phiên bản nháp mới.'
              : 'Đề đã có học viên làm bài nên không sửa nội dung được. Hãy nhân bản để tạo phiên bản mới.'}
          </p>
        )}

        {restore && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning-soft px-4 py-3">
            <p className="text-body text-warning-ink">
              Có bản đang soạn dở chưa lưu ({new Date(restore.at).toLocaleString('vi-VN')}). Khôi phục?
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setDoc(normalize(restore.doc));
                  setRestore(null);
                }}
              >
                Khôi phục
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  writeLocal(storageKey, null);
                  setRestore(null);
                }}
              >
                Bỏ bản cũ
              </Button>
            </div>
          </div>
        )}

        {mode === 'json' ? (
          <div className="flex flex-col gap-3">
            <p className="text-body text-ink-muted">
              Sửa trực tiếp tài liệu đề (định dạng ở docs/test-schema.md). Chuyển lại “Trình soạn” để áp dụng.
            </p>
            <JsonEditor
              label="Nội dung (JSON)"
              value={jsonText}
              onChange={setJsonText}
              issues={issues.map((i) => ({ path: i.path, message: i.message }))}
              readOnly={readOnly}
            />
          </div>
        ) : (
          <div
            className={cn(
              'grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]',
              showRight && 'xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,400px)]',
            )}
          >
            <aside className="rounded-xl border border-border bg-surface p-2 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
              <Outline />
            </aside>

            <section
              className="min-w-0 rounded-xl border border-border bg-surface p-5 lg:p-6"
              aria-label="Soạn nội dung"
            >
              {editor}
            </section>

            {showRight && (
              <aside className="hidden flex-col rounded-xl border border-border bg-surface xl:sticky xl:top-4 xl:flex xl:max-h-[calc(100dvh-2rem)]">
                <div role="tablist" aria-label="Bảng phụ" className="flex border-b border-border px-2">
                  {(
                    [
                      ['preview', 'Xem trước'],
                      ['issues', `Kiểm tra (${issues.length})`],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={rightTab === k}
                      onClick={() => setRightTab(k)}
                      className={cn(
                        '-mb-px border-b-2 px-3 py-2.5 text-label outline-none focus-visible:shadow-focus',
                        rightTab === k
                          ? 'border-accent font-semibold text-accent'
                          : 'border-transparent text-ink-muted hover:text-ink',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {rightTab === 'preview' ? (
                    <>
                      <p className="mb-4 text-caption text-ink-subtle">
                        Học viên sẽ thấy như sau (bấm thử được, không lưu).
                      </p>
                      <Preview />
                    </>
                  ) : (
                    <IssueList issues={issues} onPick={goToIssue} canPublish={validation.canPublish} />
                  )}
                </div>
              </aside>
            )}
          </div>
        )}

        {/* Issues for screens without the right column */}
        {mode === 'form' && (
          <details className="rounded-xl border border-border bg-surface p-4 xl:hidden">
            <summary className="cursor-pointer text-label font-medium">Kiểm tra ({issues.length})</summary>
            <div className="mt-3">
              <IssueList issues={issues} onPick={goToIssue} canPublish={validation.canPublish} />
            </div>
          </details>
        )}
      </div>
    </BuilderProvider>
  );
}

function IssueList({
  issues,
  onPick,
  canPublish,
}: {
  issues: BuilderIssue[];
  onPick: (path: string) => void;
  canPublish: boolean;
}) {
  if (!issues.length) {
    return (
      <p className="flex items-center gap-2 text-body text-success">
        <CheckCircle2 className="size-4" aria-hidden />{' '}
        {canPublish ? 'Không có lỗi — đề sẵn sàng xuất bản.' : 'Không có lỗi.'}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {issues.map((iss, k) => (
        <li key={k}>
          <button
            type="button"
            onClick={() => onPick(iss.path)}
            className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-surface-muted focus-visible:shadow-focus"
          >
            <span className="text-caption text-ink-subtle">{humanPath(iss.path)}</span>
            <span className={cn('text-label', iss.level === 'draft' ? 'text-danger' : 'text-warning-ink')}>
              {iss.message}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
