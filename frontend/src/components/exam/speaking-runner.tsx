'use client';

// Speaking (spec §6 P5): Part 1/3 questions, Part 2 cue card with 1 min preparation then up to 2 min speaking.
// Recording uses MediaRecorder (localhost is a secure context, so the microphone works); each stop uploads one
// take, which can be played back or deleted while the attempt is open. No AI grading — an admin gives feedback.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, Square, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ExamTopBar, InstructionStrip, type ReadingSize } from '@/components/exam/exam-top-bar';
import { ExamTimer } from '@/components/exam/exam-timer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { fileUrl } from '@/services/admin.service';
import { speakingApi } from '@/services/exam.service';
import type { AttemptContentDto, AttemptStateDto, ContentPart } from '@/shared/attempt';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const mmss = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

function Recorder({
  attemptId,
  part,
  limitSec,
}: {
  attemptId: string;
  part: ContentPart;
  limitSec: number | null;
}) {
  const qc = useQueryClient();
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const upload = useMutation({
    mutationFn: (v: { blob: Blob; durationMs: number }) => {
      const form = new FormData();
      form.append('partId', part.id);
      form.append('durationMs', String(Math.round(v.durationMs)));
      const ext = v.blob.type.includes('ogg') ? 'ogg' : v.blob.type.includes('mp4') ? 'm4a' : 'webm';
      form.append('audio', v.blob, `take.${ext}`);
      return speakingApi.upload(attemptId, form);
    },
    onSuccess: (d) => qc.setQueryData(['attempt', attemptId, 'speaking'], d),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không tải bản ghi lên được'),
  });

  const stop = () => {
    if (rec.current?.state === 'recording') rec.current.stop();
  };

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const s = (Date.now() - startedAt.current) / 1000;
      setElapsed(s);
      if (limitSec && s >= limitSec) stop();
    }, 250);
    return () => clearInterval(t);
  }, [recording, limitSec]);

  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Không truy cập được micro. Hãy cho phép quyền micro trong trình duyệt.');
      return;
    }
    const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
      if (blob.size > 0) upload.mutate({ blob, durationMs: Date.now() - startedAt.current });
    };
    rec.current = r;
    startedAt.current = Date.now();
    setElapsed(0);
    r.start(1000);
    setRecording(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {recording ? (
        <Button variant="danger" onClick={stop}>
          <Square className="size-4" aria-hidden /> Dừng ghi
        </Button>
      ) : (
        <Button onClick={() => void start()} disabled={upload.isPending}>
          <Mic className="size-4" aria-hidden /> {upload.isPending ? 'Đang tải lên…' : 'Ghi âm'}
        </Button>
      )}
      {recording && (
        <span role="status" className="flex items-center gap-2 font-tabular text-body text-danger">
          <span aria-hidden className="size-2.5 rounded-full bg-danger" /> Đang ghi {mmss(elapsed)}
          {limitSec ? ` / ${mmss(limitSec)}` : ''}
        </span>
      )}
    </div>
  );
}

function PrepCountdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left === null || left <= 0) return;
    const t = setTimeout(() => setLeft((l) => (l === null ? l : l - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  if (left === null)
    return (
      <Button variant="secondary" onClick={() => setLeft(seconds)}>
        Bắt đầu {Math.round(seconds / 60)} phút chuẩn bị
      </Button>
    );
  return (
    <p
      role="timer"
      className={cn('font-tabular text-body', left <= 10 ? 'text-warning-ink' : 'text-ink-muted')}
    >
      {left > 0
        ? `Chuẩn bị: còn ${mmss(left)} — ghi chú ý chính ra giấy.`
        : 'Hết giờ chuẩn bị — bấm Ghi âm và bắt đầu nói.'}
    </p>
  );
}

export function SpeakingRunner({
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
  const qc = useQueryClient();
  const parts = c.parts.filter((p) => p.speakingPart);
  const [active, setActive] = useState(parts[0]?.id ?? '');
  const [size, setSize] = useState<ReadingSize>('md');
  const [timerHidden, setTimerHidden] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const data = useQuery({ queryKey: ['attempt', s.id, 'speaking'], queryFn: () => speakingApi.get(s.id) });
  const remove = useMutation({
    mutationFn: (id: string) => speakingApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['attempt', s.id, 'speaking'] }),
  });

  const part = parts.find((p) => p.id === active) ?? parts[0];
  const sp = part?.speakingPart;
  if (!part || !sp) return null;
  const takes = data.data?.recordings.filter((r) => r.partId === part.id) ?? [];

  return (
    <div className="flex h-full flex-col" data-reading-size={size}>
      <ExamTopBar
        source={c.test.source}
        title={`${c.test.title} · Speaking`}
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
        <strong className="font-semibold">Part {part.number}</strong>
        {sp.topic ? ` — ${sp.topic}` : ''}
        {part.number === 2
          ? ' · 1 phút chuẩn bị, nói 1–2 phút.'
          : ' · trả lời từng câu, ghi âm một lần cho cả phần hoặc từng câu.'}
      </InstructionStrip>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background p-8 max-lg:p-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {sp.cueCard ? (
            <section
              lang="en"
              aria-label="Thẻ đề"
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <p className="text-reading font-semibold">{sp.cueCard.topic}</p>
              <p className="mt-3 text-reading-q text-ink-muted">You should say:</p>
              <ul className="mt-1 list-disc pl-6 text-reading-q">
                {sp.cueCard.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              {sp.cueCard.closing && <p className="mt-2 text-reading-q">{sp.cueCard.closing}</p>}
            </section>
          ) : null}
          {sp.questions.length > 0 && (
            <section
              lang="en"
              aria-label="Câu hỏi"
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <ol className="flex list-decimal flex-col gap-2 pl-6 text-reading-q">
                {sp.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </section>
          )}
          {sp.prepSeconds > 0 && <PrepCountdown key={part.id} seconds={sp.prepSeconds} />}
          <Recorder key={part.id} attemptId={s.id} part={part} limitSec={sp.speakSeconds} />
          <section aria-label="Bản ghi của bạn" className="flex flex-col gap-2">
            <h3 className="text-label font-semibold text-ink-muted">Bản ghi ({takes.length})</h3>
            {takes.length === 0 && <p className="text-body text-ink-muted">Chưa có bản ghi cho phần này.</p>}
            {takes.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <span className="text-label-sm text-ink-muted">Lần {t.take}</span>
                <audio controls preload="none" src={fileUrl(t.fileId)} className="h-9 flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Xóa bản ghi lần ${t.take}`}
                  onClick={() => remove.mutate(t.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </section>
        </div>
      </div>
      <nav
        aria-label="Chọn phần"
        className="flex items-center gap-2 border-t border-border bg-surface px-4 py-3"
      >
        {parts.map((p) => {
          const n = data.data?.recordings.filter((r) => r.partId === p.id).length ?? 0;
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
              Part {p.number} · {n} bản ghi
            </button>
          );
        })}
      </nav>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent
          title="Nộp bài Speaking?"
          description="Bản ghi sẽ được gửi cho quản trị viên nhận xét."
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Làm tiếp
            </Button>
            <Button
              onClick={() => {
                setConfirm(false);
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
