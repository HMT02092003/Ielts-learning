'use client';

// Writing result (spec §6 P5): ESTIMATE label, LanguageTool issues underlined in the essay with suggestions, the
// metrics behind the estimate, Lexical/Grammar heuristic bands with evidence, TR/CC self checklist, admin review,
// and a side-by-side comparison with an earlier essay on the same task.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Badge, SourceBadge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardLabel } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import { vi } from '@/i18n/vi';
import { fmtDateTime } from '@/i18n/vi-exam';
import { cn } from '@/lib/cn';
import { writingApi } from '@/services/exam.service';
import type { AttemptSummaryDto } from '@/shared/attempt';
import {
  ESTIMATE_DISCLAIMER,
  WRITING_CHECKLIST,
  type WritingEvaluationDto,
  type WritingIssue,
  type WritingMetrics,
  type WritingSubmissionDto,
} from '@/shared/writing';

const ISSUE_STYLE: Record<WritingIssue['category'], string> = {
  GRAMMAR: 'decoration-danger',
  SPELLING: 'decoration-danger',
  PUNCTUATION: 'decoration-warning',
  STYLE: 'decoration-info',
  OTHER: 'decoration-ink-muted',
};
const ISSUE_LABEL: Record<WritingIssue['category'], string> = {
  GRAMMAR: 'Ngữ pháp',
  SPELLING: 'Chính tả',
  PUNCTUATION: 'Dấu câu',
  STYLE: 'Văn phong',
  OTHER: 'Khác',
};

export function EstimateLabel() {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-label font-semibold text-warning-ink">
      <AlertTriangle className="size-4" aria-hidden /> {ESTIMATE_DISCLAIMER}
    </p>
  );
}

/** Essay with LanguageTool issues underlined (non-overlapping, in order). */
function AnnotatedEssay({ text, issues }: { text: string; issues: WritingIssue[] }) {
  const out: ReactNode[] = [];
  let pos = 0;
  [...issues]
    .sort((a, b) => a.offset - b.offset)
    .forEach((it, i) => {
      if (it.offset < pos) return;
      out.push(text.slice(pos, it.offset));
      out.push(
        <span
          key={i}
          title={`${ISSUE_LABEL[it.category]}: ${it.message}${it.replacements.length ? ` → ${it.replacements.join(' / ')}` : ''}`}
          className={cn(
            'underline decoration-2 decoration-wavy underline-offset-4',
            ISSUE_STYLE[it.category],
          )}
        >
          {text.slice(it.offset, it.offset + it.length)}
          <sup className="ml-0.5 font-sans text-caption text-ink-muted">{i + 1}</sup>
        </span>,
      );
      pos = it.offset + it.length;
    });
  out.push(text.slice(pos));
  return (
    <p lang="en" className="font-reading text-[1.0625rem] leading-[1.8] whitespace-pre-wrap">
      {out}
    </p>
  );
}

const METRIC_ROWS: { key: keyof WritingMetrics; label: string; fmt?: (v: number) => string }[] = [
  { key: 'words', label: 'Số từ' },
  { key: 'sentences', label: 'Số câu' },
  { key: 'paragraphs', label: 'Số đoạn' },
  { key: 'avgSentenceLength', label: 'Độ dài câu TB (từ)' },
  { key: 'typeTokenRatio', label: 'Đa dạng từ (TTR, 250 từ đầu)' },
  { key: 'repetitionRate', label: 'Tỉ lệ lặp từ', fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'longWordRatio', label: 'Từ dài (≥ 7 chữ cái)', fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'linkingWords', label: 'Từ nối (lần dùng)' },
  { key: 'distinctLinkingWords', label: 'Từ nối khác nhau' },
  { key: 'complexSentenceRatio', label: 'Câu phức', fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'errorsPer100Words', label: 'Lỗi NP + chính tả / 100 từ' },
];

function Metrics({ m, other }: { m: WritingMetrics; other?: WritingMetrics }) {
  return (
    <table className="w-full text-body">
      <tbody>
        {METRIC_ROWS.map((r) => (
          <tr key={r.key} className="border-b border-divider last:border-0">
            <td className="py-1.5 text-ink-muted">{r.label}</td>
            {other && (
              <td className="py-1.5 text-right font-tabular text-ink-muted">
                {(r.fmt ?? String)(other[r.key])}
              </td>
            )}
            <td className="py-1.5 text-right font-tabular">{(r.fmt ?? String)(m[r.key])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HumanReview({ e }: { e: WritingEvaluationDto }) {
  return (
    <Card variant="emphasis" className="flex flex-col gap-3">
      <CardLabel className="text-on-accent-muted">
        Giám khảo chấm · {e.reviewerName ?? 'Quản trị viên'} · {fmtDateTime(e.createdAt)}
      </CardLabel>
      <div className="flex flex-wrap items-end gap-6">
        <span className="font-display text-display-lg font-extralight font-tabular">
          {e.bandOverall?.toFixed(1)}
        </span>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-body">
          <dt className="text-on-accent-muted">Task Response</dt>
          <dd className="font-tabular">{e.bandTaskResponse?.toFixed(1)}</dd>
          <dt className="text-on-accent-muted">Coherence & Cohesion</dt>
          <dd className="font-tabular">{e.bandCoherence?.toFixed(1)}</dd>
          <dt className="text-on-accent-muted">Lexical Resource</dt>
          <dd className="font-tabular">{e.bandLexical?.toFixed(1)}</dd>
          <dt className="text-on-accent-muted">Grammar</dt>
          <dd className="font-tabular">{e.bandGrammar?.toFixed(1)}</dd>
        </dl>
      </div>
      {e.comment && <p className="text-body whitespace-pre-line">{e.comment}</p>}
    </Card>
  );
}

function Checklist({ sub, readOnly }: { sub: WritingSubmissionDto; readOnly: boolean }) {
  const qc = useQueryClient();
  const [state, setState] = useState(sub.selfChecklist);
  const save = useMutation({
    mutationFn: (c: Record<string, boolean>) => writingApi.checklist(sub.id, c),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['attempt', sub.attemptId, 'writing'] }),
  });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(['TR', 'CC'] as const).map((crit) => (
        <fieldset key={crit} className="flex flex-col gap-2">
          <legend className="mb-1 text-label font-semibold">
            {crit === 'TR' ? 'Task Response' : 'Coherence & Cohesion'} · tự đánh giá
          </legend>
          {WRITING_CHECKLIST.filter((x) => x.criterion === crit).map((x) => (
            <label key={x.key} className="flex items-center gap-2 text-body">
              <Checkbox
                disabled={readOnly}
                checked={state[x.key] === true}
                onCheckedChange={(v) => {
                  const next = { ...state, [x.key]: v === true };
                  setState(next);
                  save.mutate(next);
                }}
              />
              {x.label}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function Compare({ sub, current }: { sub: WritingSubmissionDto; current: WritingEvaluationDto | undefined }) {
  const mine = useQuery({
    queryKey: ['writing-mine', sub.partId],
    queryFn: () => writingApi.mine({ partId: sub.partId, pageSize: 50 }),
  });
  const others = (mine.data?.items ?? []).filter((x) => x.id !== sub.id);
  const [otherId, setOtherId] = useState('');
  const other = others.find((x) => x.id === otherId);
  const otherEval = other?.evaluations.filter((e) => e.evaluator === 'LIBRARY' && e.result).at(-1);
  if (others.length === 0)
    return <p className="text-body text-ink-muted">Chưa có bài viết khác cho task này để so sánh.</p>;
  return (
    <div className="flex flex-col gap-4">
      <NativeSelect
        aria-label="Chọn bài để so sánh"
        value={otherId}
        onChange={(e) => setOtherId(e.target.value)}
      >
        <option value="">Chọn bài trước để so sánh…</option>
        {others.map((o) => (
          <option key={o.id} value={o.id}>
            {o.submittedAt ? fmtDateTime(o.submittedAt) : ''} · {o.wordCount} từ
          </option>
        ))}
      </NativeSelect>
      {other && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <CardLabel>Bài trước ({other.submittedAt ? fmtDateTime(other.submittedAt) : ''})</CardLabel>
            <p
              lang="en"
              className="max-h-80 overflow-y-auto rounded-lg border border-border p-3 font-reading text-body whitespace-pre-wrap"
            >
              {other.text}
            </p>
          </div>
          {current?.result && otherEval?.result && (
            <div className="flex flex-col gap-2">
              <CardLabel>Chỉ số: bài trước → bài này</CardLabel>
              <Metrics m={current.result.metrics} other={otherEval.result.metrics} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskView({ sub }: { sub: WritingSubmissionDto }) {
  const qc = useQueryClient();
  const library = sub.evaluations.filter((e) => e.evaluator !== 'HUMAN');
  const latest = library.at(-1);
  const human = sub.evaluations.filter((e) => e.evaluator === 'HUMAN').at(-1);
  const result = latest?.result;
  const rerun = useMutation({
    mutationFn: () => writingApi.reevaluate(sub.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['attempt', sub.attemptId, 'writing'] }),
  });
  const pending = latest?.status === 'PENDING' || latest?.status === 'RUNNING';

  return (
    <div className="flex flex-col gap-5">
      {human ? (
        <HumanReview e={human} />
      ) : (
        <p className="text-body text-ink-muted">Chưa có điểm giám khảo — quản trị viên sẽ chấm sau.</p>
      )}
      <EstimateLabel />
      {pending && <p className="text-body text-ink-muted">Đang phân tích bài viết…</p>}
      {latest?.status === 'FAILED' && <p className="text-body text-danger">Phân tích lỗi: {latest.error}</p>}
      {result && (
        <>
          {result.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-label-sm text-warning-ink">
              {result.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card className="flex flex-col gap-3">
              <CardLabel>
                Bài viết · {sub.wordCount} từ · {result.issues.length} gợi ý
              </CardLabel>
              <AnnotatedEssay text={sub.text} issues={result.issues} />
            </Card>
            <div className="flex flex-col gap-5">
              <Card className="flex flex-col gap-3">
                <CardLabel>Band ước lượng (chỉ 2 tiêu chí)</CardLabel>
                {(
                  [
                    ['Lexical Resource', result.criteria.lexical],
                    ['Grammatical Range & Accuracy', result.criteria.grammar],
                  ] as const
                ).map(([label, cr]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-body font-medium">{label}</span>
                      <span className="font-display text-h2 font-light font-tabular">
                        {cr.band?.toFixed(1) ?? '—'}
                      </span>
                    </div>
                    <ul className="text-label-sm text-ink-muted">
                      {cr.evidence.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-label-sm text-ink-muted">
                  Task Response và Coherence & Cohesion không chấm tự động — dùng checklist bên dưới.
                </p>
              </Card>
              <Card className="flex flex-col gap-2">
                <CardLabel>Chỉ số</CardLabel>
                <Metrics m={result.metrics} />
              </Card>
            </div>
          </div>
          {result.issues.length > 0 && (
            <Card className="flex flex-col gap-2">
              <CardLabel>Gợi ý sửa</CardLabel>
              <ol className="flex flex-col gap-1.5 text-body">
                {[...result.issues]
                  .sort((a, b) => a.offset - b.offset)
                  .map((it, i) => (
                    <li key={`${it.offset}-${i}`} className="flex flex-wrap gap-x-2">
                      <span className="font-tabular text-ink-muted">{i + 1}.</span>
                      <Badge
                        variant={
                          it.category === 'GRAMMAR' || it.category === 'SPELLING' ? 'danger' : 'neutral'
                        }
                      >
                        {ISSUE_LABEL[it.category]}
                      </Badge>
                      <span lang="en" className="font-reading">
                        “{sub.text.slice(it.offset, it.offset + it.length)}”
                      </span>
                      {it.replacements.length > 0 && (
                        <span lang="en" className="font-semibold text-success">
                          → {it.replacements.join(' / ')}
                        </span>
                      )}
                      <span className="w-full pl-5 text-label-sm text-ink-muted">{it.message}</span>
                    </li>
                  ))}
              </ol>
            </Card>
          )}
          {result.degraded && (
            <Button
              variant="secondary"
              onClick={() => rerun.mutate()}
              disabled={rerun.isPending}
              className="self-start"
            >
              <RefreshCw className="size-4" aria-hidden /> Phân tích lại
            </Button>
          )}
        </>
      )}
      <Card className="flex flex-col gap-3">
        <CardLabel>Checklist</CardLabel>
        <Checklist sub={sub} readOnly={false} />
      </Card>
      <Card className="flex flex-col gap-3">
        <CardLabel>So sánh với bài trước</CardLabel>
        <Compare sub={sub} current={latest} />
      </Card>
    </div>
  );
}

export function WritingResult({ attempt }: { attempt: AttemptSummaryDto }) {
  const subs = useQuery({
    queryKey: ['attempt', attempt.id, 'writing'],
    queryFn: () => writingApi.list(attempt.id),
    refetchInterval: (q) =>
      q.state.data?.some((s) => s.evaluations.some((e) => e.status === 'PENDING' || e.status === 'RUNNING'))
        ? 1500
        : false,
  });
  const [active, setActive] = useState(0);
  if (!subs.data) return <p className="pt-8 text-body text-ink-muted">{vi.common.loading}</p>;
  const sub = subs.data[active] ?? subs.data[0];
  return (
    <div className="flex flex-col gap-6 pt-8 pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <SourceBadge source={attempt.source} />
        <h1 className="flex-1 text-h2 font-semibold">{attempt.testTitle} · Writing</h1>
        <Link href="/practice" className={buttonVariants({ variant: 'ghost' })}>
          Về thư viện đề
        </Link>
      </div>
      {subs.data.length > 1 && (
        <div role="tablist" className="flex gap-1 self-start rounded-lg bg-surface-muted p-0.5">
          {subs.data.map((x, i) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === sub?.id}
              onClick={() => setActive(i)}
              className={cn(
                'h-9 rounded-md px-3 text-label',
                x.id === sub?.id ? 'bg-surface font-semibold shadow-xs' : 'text-ink-muted',
              )}
            >
              Task {x.partNumber}
            </button>
          ))}
        </div>
      )}
      {sub ? (
        <TaskView key={sub.id} sub={sub} />
      ) : (
        <p className="text-body text-ink-muted">Không có bài viết.</p>
      )}
    </div>
  );
}
