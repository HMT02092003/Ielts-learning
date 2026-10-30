'use client';

// Writing exam screen (C-Writing, spec §6 P5): prompt (+ Task 1 visual) on the left, essay editor on the right,
// live word count with a below-minimum warning, per-task autosave (debounce 1 s, every 10 s, keepalive on hide),
// optional paste blocking in EXAM.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ExamTopBar, InstructionStrip, type ReadingSize } from '@/components/exam/exam-top-bar';
import { ExamTimer } from '@/components/exam/exam-timer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { fileUrl } from '@/services/admin.service';
import { writingApi } from '@/services/exam.service';
import type { AttemptContentDto, AttemptStateDto } from '@/shared/attempt';
import { countWords } from '@/shared/primitives';
import type { WritingSubmissionDto } from '@/shared/writing';

interface Draft {
  partId: string;
  text: string;
  seq: number;
  savedText: string;
}

export function WritingRunner({
  s,
  c,
  candidate,
  secondsLeft,
  onSubmit,
}: {
  s: AttemptStateDto;
  c: AttemptContentDto;
  candidate: string;
  secondsLeft: number | null;
  onSubmit: () => void;
}) {
  const subs = useQuery({
    queryKey: ['attempt', s.id, 'writing'],
    queryFn: () => writingApi.list(s.id),
    staleTime: Infinity,
  });
  if (!subs.data) return <p className="m-auto text-body text-ink-muted">{vi.common.loading}</p>;
  return (
    <Editor
      s={s}
      c={c}
      subs={subs.data}
      candidate={candidate}
      secondsLeft={secondsLeft}
      onSubmit={onSubmit}
    />
  );
}

function Editor({
  s,
  c,
  subs,
  candidate,
  secondsLeft,
  onSubmit,
}: {
  s: AttemptStateDto;
  c: AttemptContentDto;
  subs: WritingSubmissionDto[];
  candidate: string;
  secondsLeft: number | null;
  onSubmit: () => void;
}) {
  const parts = c.parts.filter((p) => p.writingTask);
  const [active, setActive] = useState(parts[0]?.id ?? '');
  const [size, setSize] = useState<ReadingSize>('md');
  const [timerHidden, setTimerHidden] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      parts.map((p) => {
        const sub = subs.find((x) => x.partId === p.id);
        return [
          p.id,
          { partId: p.id, text: sub?.text ?? '', seq: sub?.lastClientSeq ?? 0, savedText: sub?.text ?? '' },
        ];
      }),
    ),
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  const blockPaste = s.mode === 'EXAM' && s.settings.blockPaste;

  // Save every task whose text differs from what the server has.
  const flush = useRef(async () => undefined as void);
  useEffect(() => {
    let busy = false;
    flush.current = async () => {
      if (busy) return;
      busy = true;
      try {
        for (const d of Object.values(draftsRef.current)) {
          if (d.text === d.savedText) continue;
          const seq = d.seq + 1;
          const text = d.text;
          const r = await writingApi.save(s.id, d.partId, { clientSeq: seq, text });
          setDrafts((old) => {
            const cur = old[d.partId];
            return cur
              ? { ...old, [d.partId]: { ...cur, seq: Math.max(cur.seq, r.savedSeq), savedText: text } }
              : old;
          });
          draftsRef.current = {
            ...draftsRef.current,
            [d.partId]: { ...d, seq: Math.max(seq, r.savedSeq), savedText: text },
          };
        }
        setSavedAt(Date.now());
        setSaveError(false);
      } catch {
        setSaveError(true);
      } finally {
        busy = false;
      }
    };
    const t = setInterval(() => void flush.current(), 10_000);
    const onHide = () => {
      for (const d of Object.values(draftsRef.current)) {
        if (d.text === d.savedText) continue;
        void fetch(`/api/v1/attempts/${s.id}/writing/${d.partId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientSeq: d.seq + 1, text: d.text }),
          credentials: 'same-origin',
          keepalive: true,
        }).catch(() => undefined);
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(t);
      window.removeEventListener('pagehide', onHide);
    };
  }, [s.id]);

  // Debounced save after typing.
  useEffect(() => {
    const t = setTimeout(() => void flush.current(), 1000);
    return () => clearTimeout(t);
  }, [drafts]);

  // Last seconds: push the text before the server auto-submits.
  const flushedAtEnd = useRef(false);
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft <= 3 && !flushedAtEnd.current) {
      flushedAtEnd.current = true;
      void flush.current();
    }
  }, [secondsLeft]);

  const part = parts.find((p) => p.id === active) ?? parts[0];
  const task = part?.writingTask;
  if (!part || !task) return null;
  const draft = drafts[part.id];
  const words = countWords(draft?.text ?? '');
  const dirty = Object.values(drafts).some((d) => d.text !== d.savedText);

  return (
    <div className="flex h-full flex-col" data-reading-size={size}>
      <ExamTopBar
        source={c.test.source}
        title={`${c.test.title} · Writing`}
        candidate={candidate}
        timer={
          secondsLeft !== null ? (
            <ExamTimer
              secondsLeft={secondsLeft}
              hidden={timerHidden}
              onToggle={() => setTimerHidden((h) => !h)}
            />
          ) : (
            <span className="text-label text-ink-muted">Luyện tập · không giới hạn giờ</span>
          )
        }
        readingSize={size}
        onReadingSize={setSize}
        onSubmit={() => setConfirm(true)}
      />
      <InstructionStrip>
        <div className="flex items-center gap-3">
          <span className="flex-1">
            <strong className="font-semibold">Task {part.number}</strong> — viết ít nhất {task.minWords} từ
            {part.suggestedMinutes ? `, khuyến nghị ${part.suggestedMinutes} phút` : ''}.
          </span>
          <span className={cn('text-label-sm', saveError ? 'text-danger' : 'text-ink-muted')}>
            {saveError
              ? 'Chưa lưu được — đang thử lại'
              : dirty
                ? 'Đang lưu…'
                : savedAt
                  ? `Đã lưu nháp · ${new Date(savedAt).toTimeString().slice(0, 5)}`
                  : ''}
          </span>
        </div>
      </InstructionStrip>
      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <section
          lang="en"
          aria-label="Đề bài"
          className="overflow-y-auto border-r border-border bg-surface p-8 max-lg:max-h-[40dvh] max-lg:border-b max-lg:p-5"
        >
          <p className="text-reading whitespace-pre-line">{task.prompt}</p>
          {task.imageId && (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
            <img
              src={fileUrl(task.imageId)}
              alt="Biểu đồ / hình minh họa của đề"
              className="mt-5 h-auto max-w-full rounded-lg border border-border"
            />
          )}
        </section>
        <section aria-label="Bài viết" className="flex min-h-0 flex-col bg-background p-6 max-lg:p-4">
          <textarea
            lang="en"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="sentences"
            aria-label={`Bài viết Task ${part.number}`}
            value={draft?.text ?? ''}
            onChange={(e) => {
              const text = e.target.value;
              setDrafts((old) => {
                const cur = old[part.id];
                return cur ? { ...old, [part.id]: { ...cur, text } } : old;
              });
            }}
            onPaste={(e) => {
              if (!blockPaste) return;
              e.preventDefault();
              toast.warning('Chế độ thi đang chặn dán (paste).');
            }}
            className="min-h-0 flex-1 resize-none rounded-xl border border-border-control bg-surface p-5 font-reading text-[1.125rem] leading-[1.75] text-ink outline-none focus:border-accent focus:shadow-halo"
          />
          <div className="mt-2 flex items-center gap-3 text-label-sm">
            <span
              className={cn('font-tabular', words < task.minWords ? 'text-warning-ink' : 'text-ink-muted')}
              aria-live="off"
            >
              {words} từ
              {words < task.minWords ? ` · còn thiếu ${task.minWords - words} từ` : ' · đủ số từ tối thiểu'}
            </span>
          </div>
        </section>
      </div>
      <nav
        aria-label="Chọn task"
        className="flex items-center gap-2 border-t border-border bg-surface px-4 py-3"
      >
        {parts.map((p) => {
          const w = countWords(drafts[p.id]?.text ?? '');
          return (
            <button
              key={p.id}
              type="button"
              aria-current={p.id === part.id || undefined}
              onClick={() => setActive(p.id)}
              className={cn(
                'flex h-10 items-center rounded-md border px-3 text-body outline-none focus-visible:shadow-focus',
                p.id === part.id
                  ? 'border-ink bg-ink font-semibold text-ink-inverse'
                  : 'border-border bg-surface-muted text-ink',
              )}
            >
              Task {p.number} · {w} từ
            </button>
          );
        })}
      </nav>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="Nộp bài Writing?" description="Sau khi nộp sẽ không sửa được nữa.">
          <ul className="flex flex-col gap-1 text-body">
            {parts.map((p) => {
              const w = countWords(drafts[p.id]?.text ?? '');
              const min = p.writingTask?.minWords ?? 0;
              return (
                <li key={p.id} className={cn(w < min && 'text-warning-ink')}>
                  Task {p.number}: {w} từ{w < min ? ` (thiếu ${min - w} từ so với yêu cầu ${min})` : ''}
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Viết tiếp
            </Button>
            <Button
              onClick={async () => {
                setConfirm(false);
                await flush.current();
                onSubmit();
              }}
            >
              Nộp bài
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
