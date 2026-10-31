'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge, SourceBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SKILL_LABEL } from '@/i18n/vi-exam';
import { statsApi } from '@/services/study.service';
import type { TestCardDto } from '@/shared/attempt';

export type Section = TestCardDto['sections'][number];

export function TestCard({ test, onPick }: { test: TestCardDto; onPick: (s: Section) => void }) {
  const qc = useQueryClient();
  const mark = useMutation({
    mutationFn: (body: { done?: boolean; hidden?: boolean }) => statsApi.mark(test.seriesKey, body),
    onSuccess: (_r, body) => {
      void qc.invalidateQueries({ queryKey: ['catalog'] });
      toast.success(body.hidden ? 'Đã ẩn khỏi đề gợi ý ở Tổng quan' : 'Đã đánh dấu đã làm');
    },
  });
  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <SourceBadge source={test.source} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-title-sm font-semibold">{test.title}</h2>
          <p className="text-label-sm text-ink-muted">
            {test.type === 'ACADEMIC' ? 'Academic' : 'General Training'}
          </p>
        </div>
        {test.done ? (
          <Badge variant="success">Đã làm</Badge>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => mark.mutate({ done: true })}>
            Đánh dấu đã làm
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => mark.mutate({ hidden: true })}>
          Ẩn gợi ý
        </Button>
      </div>
      <ul className="flex flex-col divide-y divide-divider">
        {test.sections.map((s) => {
          const p = test.progress.find((x) => x.skill === s.skill);
          return (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <span className="w-20 text-label font-semibold">{SKILL_LABEL[s.skill]}</span>
              <span className="flex-1 text-label-sm text-ink-muted">
                {s.questionCount > 0 ? `${s.questionCount} câu · ` : `${s.parts.length} phần · `}
                {Math.round(s.durationSec / 60)} phút
                {p?.bestBand != null
                  ? ` · tốt nhất ${p.bestBand.toFixed(1)}`
                  : p?.attempts
                    ? ` · ${p.attempts} lần`
                    : ''}
              </span>
              <Button size="sm" variant="secondary" onClick={() => onPick(s)}>
                Làm bài
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
