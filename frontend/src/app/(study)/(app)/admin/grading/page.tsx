'use client';

// Admin grading (spec §6 P5): queue of submitted Writing tasks / Speaking attempts, human bands (4 criteria) +
// comment. Every review is a new row (history kept); stats use only these human bands (M9).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardLabel } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { vi } from '@/i18n/vi';
import { fmtDateTime } from '@/i18n/vi-exam';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { fileUrl } from '@/services/admin.service';
import { gradingApi, speakingApi, writingApi } from '@/services/exam.service';
import { meanBand, type GradingQueueItem } from '@/shared/writing';

type Kind = 'WRITING' | 'SPEAKING';
const BANDS = Array.from({ length: 19 }, (_, i) => i / 2);

function BandSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-label">
      {label}
      <NativeSelect value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {BANDS.map((b) => (
          <option key={b} value={b}>
            {b.toFixed(1)}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

function ReviewForm({
  labels,
  onSave,
  pending,
}: {
  labels: [string, string, string, string];
  onSave: (bands: [number, number, number, number], comment: string) => void;
  pending: boolean;
}) {
  const [bands, setBands] = useState<[number, number, number, number]>([6, 6, 6, 6]);
  const [comment, setComment] = useState('');
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(bands, comment);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {labels.map((l, i) => (
          <BandSelect
            key={l}
            label={l}
            value={bands[i] ?? 0}
            onChange={(v) =>
              setBands((old) => old.map((x, j) => (j === i ? v : x)) as [number, number, number, number])
            }
          />
        ))}
      </div>
      <p className="text-body">
        Overall (trung bình, làm tròn 0.5):{' '}
        <strong className="font-tabular">{meanBand(bands).toFixed(1)}</strong>
      </p>
      <label className="flex flex-col gap-1 text-label">
        Nhận xét
        <Textarea rows={5} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <Button type="submit" disabled={pending} className="self-start">
        Lưu điểm
      </Button>
    </form>
  );
}

function WritingPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const sub = useQuery({ queryKey: ['writing-sub', id], queryFn: () => writingApi.get(id) });
  const save = useMutation({
    mutationFn: (v: { b: [number, number, number, number]; comment: string }) =>
      gradingApi.reviewWriting(id, {
        bandTaskResponse: v.b[0],
        bandCoherence: v.b[1],
        bandLexical: v.b[2],
        bandGrammar: v.b[3],
        comment: v.comment,
      }),
    onSuccess: (d) => {
      qc.setQueryData(['writing-sub', id], d);
      void qc.invalidateQueries({ queryKey: ['grading'] });
      toast.success('Đã lưu điểm');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không lưu được'),
  });
  if (!sub.data) return <p className="text-body text-ink-muted">{vi.common.loading}</p>;
  const s = sub.data;
  const est = s.evaluations.filter((e) => e.evaluator === 'LIBRARY' && e.result).at(-1);
  return (
    <div className="flex flex-col gap-4">
      <CardLabel>
        {s.userName} · {s.testTitle} · Task {s.partNumber} · {s.wordCount}/{s.minWords} từ
      </CardLabel>
      <details>
        <summary className="cursor-pointer text-label text-ink-muted">Đề bài</summary>
        <p lang="en" className="mt-2 text-body whitespace-pre-line">
          {s.prompt}
        </p>
        {s.imageId && (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
          <img
            src={fileUrl(s.imageId)}
            alt="Hình của đề"
            className="mt-2 max-w-full rounded-lg border border-border"
          />
        )}
      </details>
      <p
        lang="en"
        className="max-h-[50dvh] overflow-y-auto rounded-lg border border-border bg-surface p-4 font-reading text-body whitespace-pre-wrap"
      >
        {s.text || '(bỏ trống)'}
      </p>
      {est?.result && (
        <p className="text-label-sm text-ink-muted">
          Ước lượng máy: Lexical {est.bandLexical?.toFixed(1) ?? '—'}, Grammar{' '}
          {est.bandGrammar?.toFixed(1) ?? '—'} · {est.result.issues.length} gợi ý LanguageTool ·{' '}
          {est.result.metrics.errorsPer100Words} lỗi/100 từ
        </p>
      )}
      {s.evaluations
        .filter((e) => e.evaluator === 'HUMAN')
        .map((e) => (
          <p key={e.id} className="text-label-sm text-ink-muted">
            Đã chấm {fmtDateTime(e.createdAt)} bởi {e.reviewerName}: {e.bandOverall?.toFixed(1)}
          </p>
        ))}
      <ReviewForm
        labels={['Task Response', 'Coherence & Cohesion', 'Lexical Resource', 'Grammar']}
        pending={save.isPending}
        onSave={(b, comment) => save.mutate({ b, comment })}
      />
    </div>
  );
}

function SpeakingPanel({ attemptId }: { attemptId: string }) {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ['attempt', attemptId, 'speaking'],
    queryFn: () => speakingApi.get(attemptId),
  });
  const save = useMutation({
    mutationFn: (v: { b: [number, number, number, number]; comment: string }) =>
      gradingApi.reviewSpeaking(attemptId, {
        bandFluency: v.b[0],
        bandLexical: v.b[1],
        bandGrammar: v.b[2],
        bandPronunciation: v.b[3],
        comment: v.comment,
      }),
    onSuccess: (d) => {
      qc.setQueryData(['attempt', attemptId, 'speaking'], d);
      void qc.invalidateQueries({ queryKey: ['grading'] });
      toast.success('Đã lưu điểm');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không lưu được'),
  });
  if (!data.data) return <p className="text-body text-ink-muted">{vi.common.loading}</p>;
  return (
    <div className="flex flex-col gap-4">
      <CardLabel>
        {data.data.userName} · {data.data.testTitle}
      </CardLabel>
      {data.data.recordings.map((r) => (
        <div key={r.id} className="flex items-center gap-3">
          <span className="w-24 text-label-sm text-ink-muted">
            Part {r.partNumber} · lần {r.take}
          </span>
          <audio controls preload="none" src={fileUrl(r.fileId)} className="h-9 flex-1" />
        </div>
      ))}
      <ReviewForm
        labels={['Fluency & Coherence', 'Lexical Resource', 'Grammar', 'Pronunciation']}
        pending={save.isPending}
        onSave={(b, comment) => save.mutate({ b, comment })}
      />
    </div>
  );
}

export default function GradingPage() {
  const [kind, setKind] = useState<Kind>('WRITING');
  const [status, setStatus] = useState<'PENDING' | 'REVIEWED' | 'ALL'>('PENDING');
  const [picked, setPicked] = useState<GradingQueueItem | null>(null);
  const queue = useQuery({
    queryKey: ['grading', kind, status],
    queryFn: () => gradingApi.queue({ kind, status }),
  });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-h2 font-semibold">Chấm bài</h1>
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex gap-1 rounded-lg bg-surface-muted p-0.5">
          {(['WRITING', 'SPEAKING'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setPicked(null);
              }}
              className={cn(
                'h-9 rounded-md px-3 text-label',
                kind === k ? 'bg-surface font-semibold shadow-xs' : 'text-ink-muted',
              )}
            >
              {k === 'WRITING' ? 'Writing' : 'Speaking'}
            </button>
          ))}
        </div>
        <NativeSelect
          aria-label="Trạng thái"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="PENDING">Chưa chấm</option>
          <option value="REVIEWED">Đã chấm</option>
          <option value="ALL">Tất cả</option>
        </NativeSelect>
      </div>
      {queue.isError ? (
        <ErrorState onRetry={() => void queue.refetch()} />
      ) : !queue.data ? (
        <p className="text-body text-ink-muted">{vi.common.loading}</p>
      ) : queue.data.items.length === 0 ? (
        <Card>
          <EmptyState title="Không có bài nào" body="Bài nộp mới sẽ xuất hiện ở đây." />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <ul className="flex flex-col gap-2">
            {queue.data.items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => setPicked(it)}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 rounded-xl border p-3 text-left outline-none focus-visible:shadow-focus',
                    picked?.id === it.id
                      ? 'border-accent bg-accent-soft'
                      : 'border-border bg-surface hover:border-border-control',
                  )}
                >
                  <span className="flex w-full items-center gap-2 text-body font-medium">
                    <span className="flex-1">{it.userName}</span>
                    {it.reviewed ? (
                      <Badge variant="success">{it.bandOverall?.toFixed(1)}</Badge>
                    ) : (
                      <Badge variant="warning">Chờ chấm</Badge>
                    )}
                  </span>
                  <span className="text-label-sm text-ink-muted">
                    {it.testTitle} · {it.label}
                  </span>
                  {it.submittedAt && (
                    <span className="text-label-sm text-ink-muted">{fmtDateTime(it.submittedAt)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <Card>
            {!picked ? (
              <p className="text-body text-ink-muted">Chọn một bài ở danh sách bên trái.</p>
            ) : picked.kind === 'WRITING' ? (
              <WritingPanel key={picked.id} id={picked.id} />
            ) : (
              <SpeakingPanel key={picked.id} attemptId={picked.attemptId} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
