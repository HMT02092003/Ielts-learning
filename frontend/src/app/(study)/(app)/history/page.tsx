'use client';

// Attempt history (spec §6 P4): every attempt with status, score and a link to continue or see the result.
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SkillRadarCard } from '@/components/study/stats-charts';
import { Badge, SourceBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { vi } from '@/i18n/vi';
import { MODE_LABEL, SKILL_LABEL, STATUS_LABEL, fmtDateTime } from '@/i18n/vi-exam';
import { attemptsApi } from '@/services/exam.service';
import type { Skill } from '@/shared/enums';

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [skill, setSkill] = useState<Skill | ''>('');
  const list = useQuery({
    queryKey: ['attempts', { page, skill }],
    queryFn: () => attemptsApi.list({ page, pageSize: PAGE_SIZE, skill: skill || undefined }),
  });

  return (
    <div className="flex flex-col gap-6 pt-8 pb-12">
      <h1 className="font-display text-h1 font-extralight">Lịch sử</h1>
      <SkillRadarCard />
      <div className="flex items-center gap-3">
        <NativeSelect
          aria-label="Kỹ năng"
          value={skill}
          onChange={(e) => {
            setSkill(e.target.value as Skill | '');
            setPage(1);
          }}
        >
          <option value="">Mọi kỹ năng</option>
          {(Object.keys(SKILL_LABEL) as Skill[]).map((k) => (
            <option key={k} value={k}>
              {SKILL_LABEL[k]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <p className="text-body text-ink-muted">{vi.common.loading}</p>
      ) : list.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History strokeWidth={1.75} aria-hidden />}
            title="Chưa có bài làm nào"
            body="Vào Luyện đề để làm bài đầu tiên."
            action={
              <Button asChild variant="secondary">
                <Link href="/practice">Luyện đề</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[720px] text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-ink-muted">
                  <th className="px-4 py-3 font-medium">Thời gian</th>
                  <th className="px-4 py-3 font-medium">Đề</th>
                  <th className="px-4 py-3 font-medium">Kỹ năng</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-medium">Kết quả</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((a) => {
                  const finished = a.status === 'SUBMITTED' || a.status === 'EXPIRED';
                  const open = a.status === 'CREATED' || a.status === 'IN_PROGRESS';
                  return (
                    <tr key={a.id} className="border-b border-divider last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                        {fmtDateTime(a.submittedAt ?? a.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <SourceBadge source={a.source} />
                          <span className="font-medium">{a.testTitle}</span>
                        </div>
                        <span className="text-label-sm text-ink-muted">{a.scopeLabel}</span>
                      </td>
                      <td className="px-4 py-3">
                        {SKILL_LABEL[a.skill]}{' '}
                        <Badge variant={a.mode === 'EXAM' ? 'mode-exam' : 'mode-practice'}>
                          {MODE_LABEL[a.mode]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{STATUS_LABEL[a.status]}</td>
                      <td className="px-4 py-3 text-right font-tabular">
                        {a.band !== null ? (
                          <strong className="font-semibold">{a.band.toFixed(1)}</strong>
                        ) : null}
                        {a.rawScore !== null && (
                          <span className="ml-2 text-ink-muted">
                            {a.rawScore}/{a.maxScore}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {finished && (
                          <Link
                            href={`/results/${a.id}`}
                            className="text-label font-medium text-accent hover:underline"
                          >
                            Xem kết quả
                          </Link>
                        )}
                        {open && (
                          <Link
                            href={`/attempts/${a.id}`}
                            className="text-label font-medium text-accent hover:underline"
                          >
                            Làm tiếp
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {list.data.total > PAGE_SIZE && (
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trang trước
              </Button>
              <span className="text-label-sm text-ink-muted">
                Trang {page}/{Math.ceil(list.data.total / PAGE_SIZE)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page * PAGE_SIZE >= list.data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
