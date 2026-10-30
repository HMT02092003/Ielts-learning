'use client';

// Speaking result: the recordings per part and the admin's feedback (no machine grading — spec §8).
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { SourceBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardLabel } from '@/components/ui/card';
import { vi } from '@/i18n/vi';
import { fmtDateTime } from '@/i18n/vi-exam';
import { fileUrl } from '@/services/admin.service';
import { speakingApi } from '@/services/exam.service';
import type { AttemptSummaryDto } from '@/shared/attempt';

export function SpeakingResult({ attempt }: { attempt: AttemptSummaryDto }) {
  const data = useQuery({
    queryKey: ['attempt', attempt.id, 'speaking'],
    queryFn: () => speakingApi.get(attempt.id),
  });
  if (!data.data) return <p className="pt-8 text-body text-ink-muted">{vi.common.loading}</p>;
  const review = data.data.evaluations.at(-1);
  const parts = [...new Set(data.data.recordings.map((r) => r.partNumber))].sort();
  return (
    <div className="flex flex-col gap-6 pt-8 pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <SourceBadge source={attempt.source} />
        <h1 className="flex-1 text-h2 font-semibold">{attempt.testTitle} · Speaking</h1>
        <Link href="/practice" className={buttonVariants({ variant: 'ghost' })}>
          Về thư viện đề
        </Link>
      </div>
      {review ? (
        <Card variant="emphasis" className="flex flex-col gap-3">
          <CardLabel className="text-on-accent-muted">
            Nhận xét · {review.reviewerName ?? 'Quản trị viên'} · {fmtDateTime(review.createdAt)}
          </CardLabel>
          <div className="flex flex-wrap items-end gap-6">
            <span className="font-display text-display-lg font-extralight font-tabular">
              {review.bandOverall?.toFixed(1)}
            </span>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-body">
              <dt className="text-on-accent-muted">Fluency & Coherence</dt>
              <dd className="font-tabular">{review.bandFluency?.toFixed(1)}</dd>
              <dt className="text-on-accent-muted">Lexical Resource</dt>
              <dd className="font-tabular">{review.bandLexical?.toFixed(1)}</dd>
              <dt className="text-on-accent-muted">Grammar</dt>
              <dd className="font-tabular">{review.bandGrammar?.toFixed(1)}</dd>
              <dt className="text-on-accent-muted">Pronunciation</dt>
              <dd className="font-tabular">{review.bandPronunciation?.toFixed(1)}</dd>
            </dl>
          </div>
          {review.comment && <p className="text-body whitespace-pre-line">{review.comment}</p>}
        </Card>
      ) : (
        <Card>
          <p className="text-body text-ink-muted">Chưa có nhận xét — quản trị viên sẽ nghe và chấm sau.</p>
        </Card>
      )}
      {parts.length === 0 && <p className="text-body text-ink-muted">Bài này không có bản ghi nào.</p>}
      {parts.map((n) => (
        <Card key={n} className="flex flex-col gap-3">
          <CardLabel>Part {n}</CardLabel>
          {data.data.recordings
            .filter((r) => r.partNumber === n)
            .map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <span className="w-14 text-label-sm text-ink-muted">Lần {r.take}</span>
                <audio controls preload="none" src={fileUrl(r.fileId)} className="h-9 flex-1" />
              </div>
            ))}
        </Card>
      ))}
    </div>
  );
}
