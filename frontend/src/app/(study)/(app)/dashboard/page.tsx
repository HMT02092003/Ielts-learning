'use client';

// Dashboard (C-Dashboard, spec §6 P6): greeting + exam countdown, "Tiếp tục" (the only accent card), band per
// skill with target marker, band trend, weak question types, study heatmap/streak, due flashcards, suggestions.
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Flame, Layers } from 'lucide-react';
import Link from 'next/link';
import { ErrorState } from '@/components/common/error-state';
import { BandTrendCard, SkillBandBars, StreakHeatmap } from '@/components/study/stats-charts';
import { SourceBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardLabel } from '@/components/ui/card';
import { vi } from '@/i18n/vi';
import { MODE_LABEL, QUESTION_TYPE_LABEL, SKILL_LABEL } from '@/i18n/vi-exam';
import { cn } from '@/lib/cn';
import { statsApi } from '@/services/study.service';

export default function DashboardPage() {
  const d = useQuery({ queryKey: ['stats', 'dashboard'], queryFn: statsApi.dashboard });

  if (d.isError) return <ErrorState onRetry={() => void d.refetch()} />;
  if (!d.data)
    return (
      <div className="grid gap-4 pt-8 lg:grid-cols-3" aria-busy>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-surface-muted" />
        ))}
      </div>
    );
  const x = d.data;
  const cont = x.continueAttempt;

  return (
    <div className="flex flex-col gap-6 pt-8 pb-12">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="flex-1 font-display text-h1 font-extralight text-ink">
          {vi.dashboard.hello(x.displayName)}
        </h1>
        {x.daysLeft !== null ? (
          <p className="text-body text-ink-muted">
            Còn{' '}
            <strong className="font-display text-h2 font-light text-ink font-tabular">{x.daysLeft}</strong>{' '}
            ngày tới kỳ thi
            {x.targetBand !== null ? ` · mục tiêu ${x.targetBand.toFixed(1)}` : ''}
          </p>
        ) : (
          <Link href="/settings" className="text-label text-accent hover:underline">
            Đặt ngày thi và band mục tiêu
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {cont ? (
          <Card variant="emphasis" className="flex flex-col gap-3">
            <CardLabel className="text-on-accent-muted">Tiếp tục</CardLabel>
            <p className="text-title-sm font-semibold">{cont.testTitle}</p>
            <p className="text-body text-on-accent-muted">
              {SKILL_LABEL[cont.skill]} · {MODE_LABEL[cont.mode]} · {cont.scopeLabel} · đã làm{' '}
              {cont.answeredCount} câu
            </p>
            <Link
              href={`/attempts/${cont.id}`}
              className={cn(buttonVariants({ variant: 'inverse' }), 'mt-auto self-start')}
            >
              Làm tiếp <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Card>
        ) : (
          <Card className="flex flex-col gap-3">
            <CardLabel>Bắt đầu</CardLabel>
            <p className="text-body text-ink-muted">Không có bài nào đang dở. Chọn một đề để luyện.</p>
            <Link href="/practice" className={cn(buttonVariants(), 'mt-auto self-start')}>
              <BookOpen className="size-4" aria-hidden /> Luyện đề
            </Link>
          </Card>
        )}

        <Card className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-baseline gap-3">
            <CardLabel className="flex-1">Band theo kỹ năng</CardLabel>
            <span className="text-label-sm text-ink-muted">
              Overall{' '}
              <strong className="font-display text-h2 font-light text-ink font-tabular">
                {x.overallBand?.toFixed(1) ?? '—'}
              </strong>
            </span>
          </div>
          <SkillBandBars skills={x.bandBySkill} target={x.targetBand} />
          <p className="text-label-sm text-ink-muted">
            Reading/Listening: bài làm cả kỹ năng gần nhất · Writing/Speaking: điểm giám khảo gần nhất.
          </p>
        </Card>
      </div>

      <BandTrendCard target={x.targetBand} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-3">
          <CardLabel>Dạng câu cần luyện thêm</CardLabel>
          {x.weakTypes.length === 0 ? (
            <p className="text-body text-ink-muted">
              Chưa đủ dữ liệu (cần ≥ 5 câu mỗi dạng) hoặc mọi dạng đều ≥ 65%.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {x.weakTypes.map((t) => (
                <li key={t.type} className="flex items-center gap-3 text-body">
                  <span className="flex-1">{QUESTION_TYPE_LABEL[t.type]}</span>
                  <span className="font-tabular text-danger">{Math.round((t.correct / t.total) * 100)}%</span>
                  <span className="font-tabular text-label-sm text-ink-muted">
                    {t.correct}/{t.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3 lg:col-span-2">
          <div className="flex items-center gap-3">
            <CardLabel className="flex-1">Chuỗi ngày học</CardLabel>
            <span className="flex items-center gap-1.5 text-body">
              <Flame className="size-4 text-warning" aria-hidden />
              <strong className="font-tabular">{x.streak.current}</strong> ngày
              <span className="text-ink-muted">
                · dài nhất {x.streak.best} · hôm nay {x.streak.todayMinutes} phút
              </span>
            </span>
          </div>
          <StreakHeatmap />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-3">
          <CardLabel>Flashcard</CardLabel>
          <p className="text-body">
            <strong className="font-display text-h2 font-light font-tabular">{x.cards.due}</strong> thẻ đến
            hạn · {x.cards.total} từ trong sổ
          </p>
          <Link
            href={x.cards.due > 0 ? '/vocabulary/review' : '/vocabulary'}
            className={cn(buttonVariants({ variant: 'secondary' }), 'mt-auto self-start')}
          >
            <Layers className="size-4" aria-hidden /> {x.cards.due > 0 ? 'Ôn ngay' : 'Mở sổ từ'}
          </Link>
        </Card>
        <Card className="flex flex-col gap-3 lg:col-span-2">
          <CardLabel>Đề gợi ý (chưa làm)</CardLabel>
          {x.suggestions.length === 0 ? (
            <p className="text-body text-ink-muted">Bạn đã làm hết các đề đang có.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {x.suggestions.map((t) => (
                <li key={t.testId}>
                  <Link
                    href="/practice"
                    className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-border-control"
                  >
                    <SourceBadge source={t.source} />
                    <span className="flex-1 text-body font-medium">{t.title}</span>
                    <span className="text-label-sm text-ink-muted">
                      {t.skills.map((s) => SKILL_LABEL[s][0]).join(' ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
