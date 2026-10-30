import { Badge } from '@/components/ui/badge';
import { QUESTION_TYPE_LABEL } from '@/i18n/vi-exam';
import { cn } from '@/lib/cn';
import type { ResultItem } from '@/shared/attempt';

/** One question on the result / review screens: your answer vs the key, explanation and evidence quote. */
export function AnswerRow({ it }: { it: ResultItem }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold font-tabular">{it.number}</span>
        <Badge variant={it.isCorrect ? 'success' : it.blank ? 'neutral' : 'danger'}>
          {it.isCorrect ? 'Đúng' : it.blank ? 'Bỏ trống' : 'Sai'}
        </Badge>
        <span className="text-label-sm text-ink-muted">{QUESTION_TYPE_LABEL[it.type]}</span>
      </div>
      {it.prompt && (
        <p lang="en" className="font-reading text-body text-ink-secondary">
          {it.prompt.replace(/\{\{\d+\}\}/g, '_____')}
        </p>
      )}
      <p className="text-body">
        Bạn chọn:{' '}
        <span
          lang="en"
          className={cn('font-semibold', !it.isCorrect && !it.blank && 'text-danger line-through')}
        >
          {it.yours ?? '—'}
        </span>
        {!it.isCorrect && (
          <>
            {' '}
            · Đáp án:{' '}
            <span lang="en" className="font-semibold text-success">
              {it.correct}
            </span>
          </>
        )}
        {it.accepted.length > 0 && (
          <span className="text-label-sm text-ink-muted"> (chấp nhận: {it.accepted.join(' / ')})</span>
        )}
      </p>
      {it.wordLimitExceeded && (
        <p className="text-label-sm text-warning-ink">Vượt giới hạn số từ nên bị tính sai.</p>
      )}
      {it.explanation && <p className="text-label-sm text-ink-muted">{it.explanation}</p>}
      {it.evidence && (
        <blockquote
          lang="en"
          className="border-l-2 border-border-strong pl-3 font-reading text-label-sm text-ink-secondary italic"
        >
          “{it.evidence.exact}”
        </blockquote>
      )}
    </li>
  );
}
