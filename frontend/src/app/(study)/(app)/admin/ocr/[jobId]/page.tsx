'use client';

// OCR review (design board C-AdminOCR): page image with tagged regions on the left, editable blocks on the right,
// then answer key 1–40 → assemble a draft test document → fix it in the JSON editor → create the test (DRAFT).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Merge, RotateCw, Save, Scissors } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { issuesOf, JsonEditor, type Issue } from '@/components/admin/json-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardLabel } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { vi } from '@/i18n/vi';
import { viAdmin } from '@/i18n/vi-admin';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { fileUrl, ocrApi } from '@/services/admin.service';
import { TestSource } from '@/shared/enums';
import { OcrTag, type OcrJobDetailDto, type OcrReviewDraft, type ReviewBlock } from '@/shared/ocr';

const t = viAdmin.ocr;
const TAGS = OcrTag.options;
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Có lỗi xảy ra');

/** Region outline per tag on the page image (outline only, so the scanned text stays readable). */
const TAG_OUTLINE: Record<OcrTag, string> = {
  PASSAGE: 'border-accent',
  QUESTION: 'border-info',
  OPTION: 'border-info border-dashed',
  ANSWER: 'border-warning',
  INSTRUCTION: 'border-border-strong',
  IGNORE: 'border-border border-dotted',
};

/** Tag → token classes (design: Bài đọc accent, Câu hỏi info, Đáp án warning, Hướng dẫn muted, Bỏ qua struck). */
const TAG_STYLE: Record<OcrTag, string> = {
  PASSAGE: 'bg-accent-soft text-accent border-accent',
  QUESTION: 'bg-info-soft text-info border-info',
  OPTION: 'bg-info-soft text-info border-info border-dashed',
  ANSWER: 'bg-warning-soft text-warning-ink border-warning',
  INSTRUCTION: 'bg-surface-muted text-ink-muted border-border-strong',
  IGNORE: 'bg-surface text-ink-subtle border-border line-through',
};

/** "1 TRUE", "2. colour/color", "3) B" lines from ANSWER blocks → answer key. */
function parseAnswerBlocks(blocks: ReviewBlock[]): Record<string, string[]> {
  const key: Record<string, string[]> = {};
  for (const b of blocks.filter((x) => x.tag === 'ANSWER')) {
    for (const line of b.text.split('\n')) {
      const m = /^\s*(\d{1,2})[.):]?\s+(.+?)\s*$/.exec(line);
      if (m?.[1] && m[2] && Number(m[1]) >= 1 && Number(m[1]) <= 40) {
        key[m[1]] = m[2]
          .split('/')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }
  return key;
}

function PageView({
  job,
  pageNumber,
  draft,
  selected,
  onSelect,
}: {
  job: OcrJobDetailDto;
  pageNumber: number;
  draft: OcrReviewDraft;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const page = job.pages.find((p) => p.pageNumber === pageNumber);
  if (!page) return null;
  const draftFor = (rawId: string) =>
    draft.blocks.find((b) => b.pageNumber === pageNumber && b.sourceIds.includes(rawId));
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image, not a static asset */}
      <img src={fileUrl(page.imageFileId)} alt={`Trang ${pageNumber}`} className="block h-auto w-full" />
      {page.blocks.map((raw) => {
        const d = draftFor(raw.id);
        return (
          <button
            key={raw.id}
            type="button"
            aria-label={`Khối ${raw.id}${d ? ` — ${t.tags[d.tag]}` : ''}`}
            onClick={() => d && onSelect(d.id)}
            className={cn(
              'absolute rounded-xs border-2 bg-transparent hover:bg-highlight/30',
              d ? TAG_OUTLINE[d.tag] : 'border-border',
              d?.id === selected && 'bg-highlight/40 outline-2 outline-offset-1 outline-ink',
            )}
            style={{
              left: `${raw.bbox.x * 100}%`,
              top: `${raw.bbox.y * 100}%`,
              width: `${raw.bbox.w * 100}%`,
              height: `${raw.bbox.h * 100}%`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function OcrReviewPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const job = useQuery({ queryKey: ['admin', 'ocr-job', jobId], queryFn: () => ocrApi.get(jobId) });
  if (job.isPending) return <p className="text-ink-muted">{vi.common.loading}</p>;
  if (!job.data) return <p className="text-danger">{errMsg(job.error)}</p>;
  if (!job.data.reviewDraft) {
    return (
      <p className="text-ink-muted">
        {t.status[job.data.status]} — <Link href="/admin/ocr">{vi.common.back}</Link>
      </p>
    );
  }
  // Re-mount with fresh local state whenever the server copy changes (rotate, reload).
  return <OcrReview key={job.dataUpdatedAt} job={job.data} draft0={job.data.reviewDraft} />;
}

function OcrReview({ job: jobData, draft0 }: { job: OcrJobDetailDto; draft0: OcrReviewDraft }) {
  const jobId = jobData.id;
  const job = { data: jobData };
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<OcrReviewDraft | null>(draft0);
  const [version, setVersion] = useState(jobData.draftVersion);
  const [dirty, setDirty] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    seriesKey: '',
    title: jobData.title ?? '',
    source: 'CAM',
    type: 'ACADEMIC',
  });
  const [json, setJson] = useState(() =>
    draft0.doc === undefined ? '' : JSON.stringify(draft0.doc, null, 2),
  );
  const [issues, setIssues] = useState<Issue[]>([]);
  const [publishNow, setPublishNow] = useState(false);
  const textRefs = useRef(new Map<string, HTMLTextAreaElement>());

  const update = useCallback((fn: (d: OcrReviewDraft) => OcrReviewDraft) => {
    setDraft((d) => (d ? fn(d) : d));
    setDirty(true);
  }, []);

  const pageBlocks = useMemo(
    () => draft?.blocks.filter((b) => b.pageNumber === pageNumber) ?? [],
    [draft, pageNumber],
  );

  const save = useMutation({
    mutationFn: async (next?: OcrReviewDraft) => {
      const d = next ?? draft;
      if (!d) throw new Error('no draft');
      return ocrApi.saveReview(jobId, version, d);
    },
    onSuccess: (r) => {
      setVersion(r.draftVersion);
      setDirty(false);
      toast.success(t.saved);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const rotate = useMutation({
    mutationFn: async (pageId: string) => {
      if (dirty && draft) await ocrApi.saveReview(jobId, version, draft);
      const p = job.data.pages.find((x) => x.id === pageId);
      return ocrApi.rotate(jobId, pageId, (((p?.rotation ?? 0) + 90) % 360) as 0 | 90 | 180 | 270);
    },
    onSuccess: (data) => qc.setQueryData(['admin', 'ocr-job', jobId], data),
    onError: (e) => toast.error(errMsg(e)),
  });
  const approve = useMutation({
    mutationFn: (pageId: string) => ocrApi.approvePage(jobId, pageId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'ocr-job', jobId] }),
  });

  const assemble = useMutation({
    mutationFn: async () => {
      if (dirty && draft) await save.mutateAsync(draft);
      return ocrApi.assemble(jobId, {
        seriesKey: meta.seriesKey,
        title: meta.title,
        source: meta.source as (typeof TestSource.options)[number],
        type: meta.type === 'GENERAL' ? 'GENERAL' : 'ACADEMIC',
      });
    },
    onSuccess: (r) => {
      setJson(JSON.stringify(r.doc, null, 2));
      setIssues(r.issues);
      setVersion((v) => v + 1); // assemble stores the doc in the draft (server bumps draftVersion)
    },
    onError: (e) => {
      setIssues(issuesOf(e));
      toast.error(errMsg(e));
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('no draft');
      const doc: unknown = JSON.parse(json);
      const saved = await ocrApi.saveReview(jobId, version, { ...draft, doc });
      setVersion(saved.draftVersion);
      return ocrApi.publish(jobId, publishNow);
    },
    onSuccess: (r) => {
      toast.success(t.published);
      router.push(`/admin/tests/${r.testId}`);
    },
    onError: (e) => {
      setIssues(issuesOf(e));
      toast.error(e instanceof SyntaxError ? `JSON không hợp lệ: ${e.message}` : errMsg(e));
    },
  });

  // Keyboard: J/K move between blocks, 1–6 set the tag of the selected block, Ctrl+S saves.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save.mutate(undefined);
        return;
      }
      const el = e.target as HTMLElement;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || e.repeat) return;
      const idx = pageBlocks.findIndex((b) => b.id === selected);
      if (e.key === 'j' || e.key === 'k') {
        const next = pageBlocks[Math.min(pageBlocks.length - 1, Math.max(0, idx + (e.key === 'j' ? 1 : -1)))];
        if (next) {
          setSelected(next.id);
          textRefs.current.get(next.id)?.scrollIntoView({ block: 'nearest' });
        }
      }
      const n = Number(e.key);
      const tag = TAGS[n - 1];
      if (tag && selected) {
        update((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === selected ? { ...b, tag } : b)) }));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageBlocks, selected, update, save]);

  if (!draft) return null;

  const currentPage = job.data.pages.find((p) => p.pageNumber === pageNumber);
  const lowConfidence = (b: ReviewBlock) =>
    currentPage?.blocks
      .filter((raw) => b.sourceIds.includes(raw.id))
      .reduce((n, raw) => n + raw.lowConfidenceWords.length, 0) ?? 0;

  function mergeWithNext(id: string) {
    update((d) => {
      const i = d.blocks.findIndex((b) => b.id === id);
      const a = d.blocks[i];
      const b = d.blocks[i + 1];
      if (!a || b?.pageNumber !== a.pageNumber) return d;
      const merged = { ...a, text: `${a.text}\n${b.text}`, sourceIds: [...a.sourceIds, ...b.sourceIds] };
      return { ...d, blocks: [...d.blocks.slice(0, i), merged, ...d.blocks.slice(i + 2)] };
    });
  }

  /** Split at the caret, or cut the selected text out into its own block (spec: select text → assign). */
  function split(id: string) {
    const el = textRefs.current.get(id);
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    update((d) => {
      const i = d.blocks.findIndex((b) => b.id === id);
      const a = d.blocks[i];
      if (!a) return d;
      const parts =
        e > s
          ? [a.text.slice(0, s), a.text.slice(s, e), a.text.slice(e)]
          : [a.text.slice(0, s), a.text.slice(s)];
      const pieces = parts
        .map((text, n) => ({ ...a, id: `${a.id}-${Date.now().toString(36)}-${n}`, text: text.trim() }))
        .filter((p) => p.text);
      return { ...d, blocks: [...d.blocks.slice(0, i), ...pieces, ...d.blocks.slice(i + 1)] };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-light">{job.data.title ?? 'OCR'}</h1>
          <p className="text-body text-ink-muted">
            {t.pages(job.data.pages.length)}
            {job.data.meanConfidence !== null &&
              ` · ${t.confidence} ${Math.round(job.data.meanConfidence)}%`}{' '}
            · {t.shortcuts}
          </p>
        </div>
        <Button
          variant={dirty ? 'primary' : 'secondary'}
          loading={save.isPending}
          onClick={() => save.mutate(undefined)}
        >
          <Save className="size-4" aria-hidden /> {t.saveDraft}
        </Button>
      </div>

      {/* 1. Review blocks */}
      <section aria-label={t.step.review} className="flex flex-col gap-3">
        <h2 className="text-h3 font-semibold">{t.step.review}</h2>
        <div className="flex flex-wrap gap-1">
          {job.data.pages.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={p.pageNumber === pageNumber ? 'primary' : 'secondary'}
              onClick={() => setPageNumber(p.pageNumber)}
            >
              Trang {p.pageNumber}
              {p.reviewStatus === 'APPROVED' && <Check className="size-3.5" aria-label={t.approved} />}
            </Button>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            {currentPage && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={rotate.isPending}
                  onClick={() => rotate.mutate(currentPage.id)}
                >
                  <RotateCw className="size-4" aria-hidden /> {t.rotate}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => approve.mutate(currentPage.id)}>
                  <Check className="size-4" aria-hidden /> {t.approve}
                </Button>
              </div>
            )}
            <PageView
              job={job.data}
              pageNumber={pageNumber}
              draft={draft}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
          <div className="flex max-h-[85vh] flex-col gap-3 overflow-y-auto pr-1">
            {pageBlocks.map((b) => {
              const low = lowConfidence(b);
              return (
                <div
                  key={b.id}
                  onFocus={() => setSelected(b.id)}
                  onClick={() => setSelected(b.id)}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border bg-surface p-3',
                    b.id === selected ? 'border-accent shadow-halo' : 'border-border',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <NativeSelect
                      aria-label="Nhãn"
                      value={b.tag}
                      onChange={(e) => {
                        const tag = e.target.value as OcrTag;
                        update((d) => ({
                          ...d,
                          blocks: d.blocks.map((x) => (x.id === b.id ? { ...x, tag } : x)),
                        }));
                      }}
                    >
                      {TAGS.map((tag, i) => (
                        <option key={tag} value={tag}>
                          {i + 1}. {t.tags[tag]}
                        </option>
                      ))}
                    </NativeSelect>
                    <span
                      className={cn(
                        'rounded-sm border px-2 py-0.5 text-caption font-semibold',
                        TAG_STYLE[b.tag],
                      )}
                    >
                      {t.tags[b.tag]}
                    </span>
                    {low > 0 && <Badge variant="warning">{t.lowConfidence(low)}</Badge>}
                    <div className="ml-auto flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t.split}
                        title={t.assignSelection}
                        onClick={() => split(b.id)}
                      >
                        <Scissors className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t.merge}
                        title={t.merge}
                        onClick={() => mergeWithNext(b.id)}
                      >
                        <Merge className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    ref={(el) => {
                      if (el) textRefs.current.set(b.id, el);
                      else textRefs.current.delete(b.id);
                    }}
                    lang="en"
                    aria-label={`Nội dung khối ${b.id}`}
                    value={b.text}
                    onChange={(e) => {
                      const text = e.target.value;
                      update((d) => ({
                        ...d,
                        blocks: d.blocks.map((x) => (x.id === b.id ? { ...x, text } : x)),
                      }));
                    }}
                    className={cn(
                      'min-h-20 font-reading text-[0.9375rem]',
                      b.tag === 'IGNORE' && 'line-through',
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Answer key */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardLabel>{t.answerKey}</CardLabel>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              update((d) => ({ ...d, answerKey: { ...d.answerKey, ...parseAnswerBlocks(d.blocks) } }))
            }
          >
            {t.parseAnswers}
          </Button>
        </div>
        <p className="mt-1 mb-4 text-body text-ink-muted">{t.answerKeyHelp}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {Array.from({ length: 40 }, (_, i) => String(i + 1)).map((n) => (
            <label key={n} className="flex items-center gap-1.5 text-body">
              <span className="w-6 text-right font-semibold text-ink-muted">{n}</span>
              <Input
                aria-label={`Đáp án câu ${n}`}
                className="h-9 px-2 text-body"
                value={(draft.answerKey[n] ?? []).join('/')}
                onChange={(e) => {
                  const list = e.target.value.split('/').map((s) => s.trim());
                  update((d) => ({
                    ...d,
                    answerKey: { ...d.answerKey, [n]: list.filter(Boolean).length ? list : [] },
                  }));
                }}
              />
            </label>
          ))}
        </div>
      </Card>

      {/* 3. Assemble + 4. Publish */}
      <Card className="flex flex-col gap-4">
        <CardLabel>{t.step.assemble}</CardLabel>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="o-series">{t.seriesKey}</Label>
            <Input
              id="o-series"
              value={meta.seriesKey}
              onChange={(e) => setMeta({ ...meta, seriesKey: e.target.value.toLowerCase() })}
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="o-title">{t.testTitle}</Label>
            <Input
              id="o-title"
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="o-source">Nguồn</Label>
            <NativeSelect
              id="o-source"
              value={meta.source}
              onChange={(e) => setMeta({ ...meta, source: e.target.value })}
            >
              {TestSource.options.map((s) => (
                <option key={s} value={s}>
                  {viAdmin.source[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <Button
          className="self-start"
          variant="secondary"
          disabled={!meta.seriesKey || !meta.title}
          loading={assemble.isPending}
          onClick={() => assemble.mutate()}
        >
          {t.assemble}
        </Button>
        {json && (
          <>
            <JsonEditor label="Tài liệu đề (JSON)" value={json} onChange={setJson} issues={issues} />
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-body">
                <Checkbox checked={publishNow} onCheckedChange={(v) => setPublishNow(v === true)} />
                {t.publishNow}
              </label>
              <Button
                loading={publish.isPending}
                disabled={job.data.status !== 'NEEDS_REVIEW'}
                onClick={() => publish.mutate()}
              >
                {t.publish}
              </Button>
              {job.data.importedTestId && (
                <Link
                  className="text-body text-accent underline"
                  href={`/admin/tests/${job.data.importedTestId}`}
                >
                  Mở đề đã tạo
                </Link>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
