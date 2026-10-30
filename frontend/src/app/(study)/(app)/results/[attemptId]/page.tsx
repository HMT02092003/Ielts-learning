'use client';

// Result screen (C-Result, spec §6 P4): band count-up, raw score, every question (filter Sai / Bỏ trống / Tất cả,
// default Sai), accuracy by question type, time per part vs recommended, "Làm lại câu sai", "Xem lại bài".
import { useMutation, useQuery } from '@tanstack/react-query';
import { animate, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { AnswerRow } from '@/components/study/answer-row';
import { SpeakingResult } from '@/components/study/speaking-result';
import { WritingResult } from '@/components/study/writing-result';
import { Badge, SourceBadge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardLabel } from '@/components/ui/card';
import { vi } from '@/i18n/vi';
import { MODE_LABEL, QUESTION_TYPE_LABEL, SKILL_LABEL, fmtDateTime, fmtDuration } from '@/i18n/vi-exam';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { attemptsApi } from '@/services/exam.service';

function BandCountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return;
    const c = animate(0, value, { duration: 0.8, ease: [0.2, 0, 0, 1], onUpdate: setShown });
    return () => c.stop();
  }, [value, reduce]);
  return (
    <>
      <span aria-hidden className="font-display text-display-xl leading-none font-extralight font-tabular">
        {(reduce ? value : shown).toFixed(1)}
      </span>
      <span className="sr-only">Band {value.toFixed(1)}</span>
    </>
  );
}

type Filter = 'wrong' | 'blank' | 'all';

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('wrong');
  const result = useQuery({
    queryKey: ['attempt', attemptId, 'result'],
    queryFn: () => attemptsApi.result(attemptId),
  });
  const retry = useMutation({
    mutationFn: () => attemptsApi.retryWrong(attemptId),
    onSuccess: (r) => router.push(`/attempts/${r.attempt.id}`),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không tạo được bài làm lại'),
  });

  if (result.isError) {
    const notSubmitted = result.error instanceof ApiError && result.error.code === 'ATTEMPT_NOT_SUBMITTED';
    return notSubmitted ? (
      <div className="flex flex-col items-start gap-3 pt-8">
        <h1 className="text-h2 font-semibold">Bài chưa nộp</h1>
        <Link href={`/attempts/${attemptId}`} className={buttonVariants()}>
          Làm tiếp
        </Link>
      </div>
    ) : (
      <ErrorState onRetry={() => void result.refetch()} />
    );
  }
  if (!result.data) return <p className="pt-8 text-body text-ink-muted">{vi.common.loading}</p>;

  const r = result.data;
  const a = r.attempt;
  if (a.skill === 'WRITING') return <WritingResult attempt={a} />;
  if (a.skill === 'SPEAKING') return <SpeakingResult attempt={a} />;

  const wrong = r.items.filter((i) => !i.isCorrect && !i.blank);
  const blank = r.items.filter((i) => i.blank);
  const shown =
    filter === 'wrong'
      ? [...wrong, ...blank].sort((x, y) => x.number - y.number)
      : filter === 'blank'
        ? blank
        : r.items;
  const delta = a.band !== null && r.previousBand !== null ? a.band - r.previousBand : null;

  return (
    <div className="flex flex-col gap-6 pt-8 pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <SourceBadge source={a.source} />
        <h1 className="text-h2 font-semibold">{a.testTitle}</h1>
        <Badge variant={a.mode === 'EXAM' ? 'mode-exam' : 'mode-practice'}>{MODE_LABEL[a.mode]}</Badge>
        {a.status === 'EXPIRED' && <Badge variant="warning">Hết giờ — tự nộp</Badge>}
      </div>
      <p className="-mt-4 text-body text-ink-muted">
        {SKILL_LABEL[a.skill]} · {a.scopeLabel}
        {a.submittedAt ? ` · nộp lúc ${fmtDateTime(a.submittedAt)}` : ''}
        {r.timeSpentMs ? ` · làm trong ${fmtDuration(r.timeSpentMs)}` : ''}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card variant="emphasis" className="flex flex-col gap-4">
          <CardLabel className="text-on-accent-muted">{a.band !== null ? 'Band ước tính' : 'Điểm'}</CardLabel>
          <div className="flex items-end gap-6">
            {a.band !== null ? (
              <BandCountUp value={a.band} />
            ) : (
              <span className="font-display text-display-xl leading-none font-extralight font-tabular">
                {a.rawScore ?? 0}/{a.maxScore ?? 0}
              </span>
            )}
            <div className="flex flex-col gap-1 pb-2 text-body">
              {a.band !== null && (
                <span className="font-semibold font-tabular">
                  {a.rawScore}/{a.maxScore} câu đúng
                </span>
              )}
              {delta !== null && (
                <span className="text-on-accent-muted">
                  {delta === 0
                    ? 'Bằng lần trước'
                    : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} so với lần trước`}
                </span>
              )}
              {r.targetBand !== null && a.band !== null && (
                <span className="text-on-accent-muted">Mục tiêu {r.targetBand.toFixed(1)}</span>
              )}
            </div>
          </div>
          {a.band !== null && r.bandTable?.isReference && (
            <p className="text-label-sm text-on-accent-muted">
              Quy đổi theo bảng band tham khảo (v{r.bandTable.version}), không phải bảng chính thức.
            </p>
          )}
          {a.band === null && a.scope !== 'SECTION' && (
            <p className="text-label-sm text-on-accent-muted">
              Luyện một phần nên chỉ tính số câu đúng, không quy đổi band.
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <CardLabel>Theo phần</CardLabel>
          <ul className="flex flex-col gap-3">
            {r.byPart.map((p) => (
              <li key={p.partNumber} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-body">
                  <span className="font-semibold">Part {p.partNumber}</span>
                  <span className="font-tabular">
                    {p.correct}/{p.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-track" aria-hidden>
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${p.total ? (p.correct / p.total) * 100 : 0}%` }}
                  />
                </div>
                {p.timeSpentMs > 0 && (
                  <span
                    className={cn(
                      'text-label-sm',
                      p.suggestedMinutes && p.timeSpentMs > p.suggestedMinutes * 60000
                        ? 'text-warning-ink'
                        : 'text-ink-muted',
                    )}
                  >
                    {fmtDuration(p.timeSpentMs)}
                    {p.suggestedMinutes ? ` · khuyến nghị ${p.suggestedMinutes} phút` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <CardLabel>Độ chính xác theo dạng câu hỏi</CardLabel>
        <ul className="grid gap-x-8 gap-y-2 md:grid-cols-2">
          {[...r.byType]
            .sort((x, y) => x.correct / x.total - y.correct / y.total)
            .map((t) => {
              const pct = Math.round((t.correct / t.total) * 100);
              return (
                <li key={t.type} className="flex items-center gap-3 text-body">
                  <span className="flex-1">{QUESTION_TYPE_LABEL[t.type]}</span>
                  <span className={cn('font-tabular', pct < 65 ? 'text-danger' : 'text-ink')}>
                    {t.correct}/{t.total} · {pct}%
                  </span>
                </li>
              );
            })}
        </ul>
      </Card>

      <div className="flex flex-wrap gap-3">
        {wrong.length + blank.length > 0 && (
          <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
            Làm lại {wrong.length + blank.length} câu sai / bỏ trống
          </Button>
        )}
        <Link href={`/results/${attemptId}/review`} className={buttonVariants({ variant: 'secondary' })}>
          Xem lại bài
        </Link>
        <Link href="/practice" className={buttonVariants({ variant: 'ghost' })}>
          Về thư viện đề
        </Link>
      </div>

      <section aria-labelledby="answers-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="answers-h" className="flex-1 text-h3 font-semibold">
            Đáp án
          </h2>
          <div role="radiogroup" aria-label="Lọc câu" className="flex rounded-lg bg-surface-muted p-0.5">
            {(
              [
                ['wrong', `Sai (${wrong.length + blank.length})`],
                ['blank', `Bỏ trống (${blank.length})`],
                ['all', `Tất cả (${r.items.length})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={filter === k}
                onClick={() => setFilter(k)}
                className={cn(
                  'h-9 rounded-md px-3 text-label',
                  filter === k ? 'bg-surface font-semibold shadow-xs' : 'text-ink-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="text-body text-ink-muted">Không có câu nào ở mục này. 🎯</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((it) => (
              <AnswerRow key={it.questionId} it={it} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
