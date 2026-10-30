'use client';

// Reading passage with highlights + notes (spec §6 P3, decision D4: self-written, no web-highlighter).
// Anchors are UTF-16 offsets into the paragraph's normalized text (each <p> holds exactly one text node), and
// rendering uses the CSS Custom Highlight API — no DOM mutation, so React re-renders and font-size changes are safe.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, Highlighter, StickyNote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api-client';
import { annotationsApi } from '@/services/exam.service';
import { vocabApi } from '@/services/study.service';
import { fileUrl } from '@/services/admin.service';
import type { AnnotationDto, ContentPart } from '@/shared/attempt';

interface Selection {
  paragraphId: string;
  start: number;
  end: number;
  exact: string;
  x: number;
  y: number;
}

const supportsHighlights = () => typeof CSS !== 'undefined' && 'highlights' in CSS;

/** Paint all annotations of the visible passage. */
function paint(root: HTMLElement | null, annotations: AnnotationDto[]) {
  if (!supportsHighlights() || !root) return;
  const plain: Range[] = [];
  const notes: Range[] = [];
  for (const a of annotations) {
    if (a.targetKind !== 'PARAGRAPH') continue;
    const node = root.querySelector(`[data-anchor="${a.targetId}"]`)?.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) continue;
    const len = node.textContent?.length ?? 0;
    if (a.endOffset > len) continue;
    const r = document.createRange();
    r.setStart(node, a.startOffset);
    r.setEnd(node, a.endOffset);
    (a.kind === 'NOTE' ? notes : plain).push(r);
  }
  CSS.highlights.set('exam-hl', new Highlight(...plain));
  CSS.highlights.set('exam-note', new Highlight(...notes));
}

export function PassagePane({
  attemptId,
  part,
  readOnly,
  allowSaveWord,
}: {
  attemptId: string;
  part: ContentPart;
  readOnly?: boolean;
  /** "Lưu từ" into the vocabulary notebook — PRACTICE attempts and the review screen only. */
  allowSaveWord?: boolean;
}) {
  const qc = useQueryClient();
  const root = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const key = ['attempt', attemptId, 'annotations'];
  const annotations = useQuery({ queryKey: key, queryFn: () => annotationsApi.list(attemptId) });
  const list = annotations.data ?? [];
  const mine = list.filter((a) => part.passage?.paragraphs.some((p) => p.id === a.targetId));

  useEffect(() => {
    paint(root.current, list);
  });
  useEffect(
    () => () => {
      if (supportsHighlights()) {
        CSS.highlights.delete('exam-hl');
        CSS.highlights.delete('exam-note');
      }
    },
    [],
  );

  const create = useMutation({
    mutationFn: (v: { kind: 'HIGHLIGHT' | 'NOTE'; note: string | null; s: Selection }) =>
      annotationsApi.create(attemptId, {
        clientId: crypto.randomUUID(),
        kind: v.kind,
        targetKind: 'PARAGRAPH',
        targetId: v.s.paragraphId,
        field: null,
        startOffset: v.s.start,
        endOffset: v.s.end,
        exact: v.s.exact,
        prefix: '',
        suffix: '',
        note: v.note,
      }),
    onSuccess: (a) => qc.setQueryData<AnnotationDto[]>(key, (old) => [...(old ?? []), a]),
  });
  const saveWord = useMutation({
    mutationFn: (s: Selection) =>
      vocabApi.create({
        term: s.exact.trim(),
        source: { attemptId, paragraphId: s.paragraphId, start: s.start, end: s.end },
      }),
    onSuccess: (w) => toast.success(`Đã lưu “${w.term}” vào sổ từ`),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không lưu được từ'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => annotationsApi.remove(id),
    onSuccess: (_r, id) =>
      qc.setQueryData<AnnotationDto[]>(key, (old) => (old ?? []).filter((a) => a.id !== id)),
  });

  const readSelection = useCallback(() => {
    if (readOnly && !allowSaveWord) return;
    const s = window.getSelection();
    if (!s || s.isCollapsed || s.rangeCount === 0) {
      setSel(null);
      return;
    }
    const range = s.getRangeAt(0);
    const p = range.startContainer.parentElement?.closest('[data-anchor]');
    const pEnd = range.endContainer.parentElement?.closest('[data-anchor]');
    // Highlights stay inside one paragraph (keeps anchors exact); select again per paragraph otherwise.
    if (!p || p !== pEnd || range.startContainer !== range.endContainer) {
      setSel(null);
      return;
    }
    const start = Math.min(range.startOffset, range.endOffset);
    const end = Math.max(range.startOffset, range.endOffset);
    const exact = (range.startContainer.textContent ?? '').slice(start, end);
    if (!exact.trim()) return;
    const rect = range.getBoundingClientRect();
    const box = root.current?.getBoundingClientRect();
    setSel({
      paragraphId: p.getAttribute('data-anchor') ?? '',
      start,
      end,
      exact,
      x: rect.left - (box?.left ?? 0) + rect.width / 2,
      y: rect.top - (box?.top ?? 0) + (root.current?.scrollTop ?? 0),
    });
    setNoteDraft(null);
  }, [readOnly, allowSaveWord]);

  const overlapping = sel
    ? mine.filter((a) => a.targetId === sel.paragraphId && a.startOffset < sel.end && a.endOffset > sel.start)
    : [];

  const done = () => {
    setSel(null);
    setNoteDraft(null);
    window.getSelection()?.removeAllRanges();
  };

  if (!part.passage) return null;
  return (
    <div ref={root} className="relative" onMouseUp={readSelection} onKeyUp={readSelection}>
      <h2 className="mb-1 font-reading text-[1.75rem] leading-tight font-semibold">{part.passage.title}</h2>
      {part.passage.subtitle && (
        <p className="mb-5 font-reading italic text-ink-muted">{part.passage.subtitle}</p>
      )}
      <div className="flex max-w-[640px] flex-col gap-5">
        {part.passage.paragraphs.map((para) =>
          para.kind === 'FIGURE' && para.imageId ? (
            <figure key={para.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
              <img src={fileUrl(para.imageId)} alt={para.text} className="h-auto max-w-full rounded-lg" />
              <figcaption className="mt-1 text-caption text-ink-muted">{para.text}</figcaption>
            </figure>
          ) : (
            <div key={para.id} className="grid grid-cols-[28px_1fr] gap-2">
              <span
                className="pt-1 font-sans text-[0.9375rem] font-semibold text-ink"
                aria-hidden={!para.label}
              >
                {para.label ?? ''}
              </span>
              <p
                data-anchor={para.id}
                className={cn(
                  'text-reading',
                  para.kind === 'HEADING' && 'font-semibold',
                  para.kind === 'SUBHEADING' && 'italic',
                  para.kind === 'FOOTNOTE' && 'text-caption text-ink-muted',
                )}
              >
                {para.text}
              </p>
            </div>
          ),
        )}
      </div>

      {sel && (
        <div
          role="toolbar"
          aria-label="Đánh dấu đoạn đã chọn"
          className="absolute z-20 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-lg bg-ink p-1 text-ink-inverse shadow-md"
          style={{ left: sel.x, top: sel.y - 8 }}
          onMouseUp={(e) => e.stopPropagation()}
        >
          {allowSaveWord && noteDraft === null && sel.exact.trim().split(/s+/).length <= 5 && (
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-label-sm hover:bg-ink-muted"
              onClick={() => {
                saveWord.mutate(sel);
                done();
              }}
            >
              <BookmarkPlus className="size-4" aria-hidden /> Lưu từ
            </button>
          )}
          {readOnly ? null : noteDraft === null ? (
            <>
              <button
                type="button"
                className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-label-sm hover:bg-ink-muted"
                onClick={() => {
                  create.mutate({ kind: 'HIGHLIGHT', note: null, s: sel });
                  done();
                }}
              >
                <span aria-hidden className="size-3 rounded-xs bg-highlight" />{' '}
                <Highlighter className="size-4" aria-hidden /> Tô sáng
              </button>
              <button
                type="button"
                className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-label-sm hover:bg-ink-muted"
                onClick={() => setNoteDraft('')}
              >
                <StickyNote className="size-4" aria-hidden /> Thêm ghi chú
              </button>
              {overlapping.length > 0 && (
                <button
                  type="button"
                  className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-label-sm hover:bg-ink-muted"
                  onClick={() => {
                    overlapping.forEach((a) => remove.mutate(a.id));
                    done();
                  }}
                >
                  <Trash2 className="size-4" aria-hidden /> Xóa
                </button>
              )}
            </>
          ) : (
            <form
              className="flex items-center gap-1 p-1"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate({ kind: 'NOTE', note: noteDraft.trim() || null, s: sel });
                done();
              }}
            >
              <input
                autoFocus
                aria-label="Nội dung ghi chú"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                className="h-8 w-56 rounded-md bg-surface px-2 text-body text-ink outline-none"
              />
              <button type="submit" className="h-8 rounded-md px-2.5 text-label-sm hover:bg-ink-muted">
                Lưu
              </button>
            </form>
          )}
        </div>
      )}

      {mine.some((a) => a.kind === 'NOTE') && (
        <aside
          aria-label="Ghi chú của bạn"
          className="mt-8 flex max-w-[640px] flex-col gap-2 border-t border-border pt-4"
        >
          <h3 className="text-label font-semibold text-ink-muted">Ghi chú</h3>
          {mine
            .filter((a) => a.kind === 'NOTE')
            .map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-body"
              >
                <p className="flex-1">
                  <span lang="en" className="font-reading italic">
                    “{a.exact}”
                  </span>
                  {a.note && <span className="block text-warning-ink">{a.note}</span>}
                </p>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label="Xóa ghi chú"
                    onClick={() => remove.mutate(a.id)}
                    className="rounded-md p-1 text-ink-muted hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
        </aside>
      )}
    </div>
  );
}
