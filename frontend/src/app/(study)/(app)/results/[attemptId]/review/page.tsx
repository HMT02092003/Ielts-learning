'use client';

// "Xem lại bài": the passage read-only with the student's highlights/notes, next to every answer of that part.
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { PassagePane } from '@/components/exam/passage';
import { AnswerRow } from '@/components/study/answer-row';
import { buttonVariants } from '@/components/ui/button';
import { vi } from '@/i18n/vi';
import { cn } from '@/lib/cn';
import { attemptsApi } from '@/services/exam.service';

export default function ReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const result = useQuery({
    queryKey: ['attempt', attemptId, 'result'],
    queryFn: () => attemptsApi.result(attemptId),
  });
  const content = useQuery({
    queryKey: ['attempt', attemptId, 'content'],
    queryFn: () => attemptsApi.content(attemptId),
  });
  const [partNo, setPartNo] = useState<number | null>(null);

  if (result.isError || content.isError)
    return <ErrorState onRetry={() => void Promise.all([result.refetch(), content.refetch()])} />;
  if (!result.data || !content.data)
    return <p className="pt-8 text-body text-ink-muted">{vi.common.loading}</p>;

  const parts = content.data.parts;
  const part = parts.find((p) => p.number === partNo) ?? parts[0];
  if (!part) return null;
  const items = result.data.items.filter((i) => i.partNumber === part.number);

  return (
    <div className="flex flex-col gap-5 pt-8 pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-h2 font-semibold">Xem lại · {result.data.attempt.testTitle}</h1>
        <Link href={`/results/${attemptId}`} className={buttonVariants({ variant: 'secondary' })}>
          Về kết quả
        </Link>
      </div>
      {parts.length > 1 && (
        <div
          role="tablist"
          aria-label="Chọn phần"
          className="flex gap-1 rounded-lg bg-surface-muted p-0.5 self-start"
        >
          {parts.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === part.id}
              onClick={() => setPartNo(p.number)}
              className={cn(
                'h-9 rounded-md px-3 text-label',
                p.id === part.id ? 'bg-surface font-semibold shadow-xs' : 'text-ink-muted',
              )}
            >
              Part {p.number}
            </button>
          ))}
        </div>
      )}
      <div className={cn('grid gap-6', part.passage && 'lg:grid-cols-2')}>
        {part.passage && (
          <section
            lang="en"
            aria-label={vi.exam.passage}
            className="rounded-2xl border border-border bg-surface p-8 lg:max-h-[calc(100dvh-220px)] lg:overflow-y-auto"
          >
            <PassagePane attemptId={attemptId} part={part} readOnly allowSaveWord />
          </section>
        )}
        <ul className="flex flex-col gap-2 lg:max-h-[calc(100dvh-220px)] lg:overflow-y-auto">
          {items.map((it) => (
            <AnswerRow key={it.questionId} it={it} />
          ))}
        </ul>
      </div>
    </div>
  );
}
