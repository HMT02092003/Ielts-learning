'use client';

// Practice library (spec §6 P3): published tests sorted CAM → VOL → Pre-IELTS, filters, and a start dialog
// (EXAM/PRACTICE, whole skill / one part / question types). Starting the same scope again resumes the open attempt.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Badge, SourceBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { vi } from '@/i18n/vi';
import { MODE_LABEL, QUESTION_TYPE_LABEL, SKILL_LABEL } from '@/i18n/vi-exam';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { attemptsApi, catalogApi } from '@/services/exam.service';
import { statsApi } from '@/services/study.service';
import type { TestCardDto } from '@/shared/attempt';
import type { QuestionType, Skill, TestSource } from '@/shared/enums';

type Section = TestCardDto['sections'][number];

export default function PracticePage() {
  const [q, setQ] = useState('');
  const [source, setSource] = useState<TestSource | ''>('');
  const [skill, setSkill] = useState<Skill | ''>('');
  const [done, setDone] = useState<'' | 'true' | 'false'>('');
  const [picked, setPicked] = useState<{ test: TestCardDto; section: Section } | null>(null);

  const list = useQuery({
    queryKey: ['catalog', { q, source, skill, done }],
    queryFn: () =>
      catalogApi.list({
        pageSize: 100,
        q: q.trim() || undefined,
        source: source || undefined,
        skill: skill || undefined,
        done: done || undefined,
      }),
  });

  return (
    <div className="flex flex-col gap-6 pt-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1 font-extralight">Luyện đề</h1>
        <p className="text-body text-ink-muted">
          Chọn một đề và kỹ năng. Bài dở cùng phạm vi sẽ được mở lại để làm tiếp.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Tìm đề</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên đề…"
            className="pl-9"
          />
        </label>
        <NativeSelect
          aria-label="Nguồn"
          value={source}
          onChange={(e) => setSource(e.target.value as TestSource | '')}
        >
          <option value="">Mọi nguồn</option>
          <option value="CAM">CAM</option>
          <option value="VOL">VOL</option>
          <option value="PRE_IELTS">Pre-IELTS</option>
          <option value="CUSTOM">Tự soạn</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Kỹ năng"
          value={skill}
          onChange={(e) => setSkill(e.target.value as Skill | '')}
        >
          <option value="">Mọi kỹ năng</option>
          {(Object.keys(SKILL_LABEL) as Skill[]).map((k) => (
            <option key={k} value={k}>
              {SKILL_LABEL[k]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Trạng thái"
          value={done}
          onChange={(e) => setDone(e.target.value as '' | 'true' | 'false')}
        >
          <option value="">Tất cả</option>
          <option value="false">Chưa làm</option>
          <option value="true">Đã làm</option>
        </NativeSelect>
      </div>

      {list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <p className="text-body text-ink-muted">{vi.common.loading}</p>
      ) : list.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen strokeWidth={1.75} aria-hidden />}
            title="Chưa có đề phù hợp"
            body="Thử bỏ bớt bộ lọc, hoặc nhờ quản trị viên nhập và xuất bản đề."
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.data.items.map((t) => (
            <li key={t.id}>
              <TestCard test={t} onPick={(section) => setPicked({ test: t, section })} />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={picked !== null} onOpenChange={(o) => !o && setPicked(null)}>
        {picked && <StartDialog key={picked.section.id} test={picked.test} section={picked.section} />}
      </Dialog>
    </div>
  );
}

function TestCard({ test, onPick }: { test: TestCardDto; onPick: (s: Section) => void }) {
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

function StartDialog({ test, section }: { test: TestCardDto; section: Section }) {
  const router = useRouter();
  const [mode, setMode] = useState<'EXAM' | 'PRACTICE'>('PRACTICE');
  const [scope, setScope] = useState<'SECTION' | 'PART' | 'QUESTION_TYPE'>('SECTION');
  const [partId, setPartId] = useState(section.parts[0]?.id ?? '');
  const [types, setTypes] = useState<QuestionType[]>([]);
  const canByType = mode === 'PRACTICE' && section.questionTypes.length > 1;
  const effectiveScope = scope === 'QUESTION_TYPE' && !canByType ? 'SECTION' : scope;

  const start = useMutation({
    mutationFn: () =>
      attemptsApi.start({
        testId: test.id,
        skill: section.skill,
        mode,
        scope: effectiveScope,
        partId: effectiveScope === 'PART' ? partId : undefined,
        questionTypes: effectiveScope === 'QUESTION_TYPE' ? types : undefined,
      }),
    onSuccess: (r) => {
      if (r.resumed) toast.info('Mở lại bài đang làm dở cùng phạm vi.');
      router.push(`/attempts/${r.attempt.id}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không bắt đầu được bài'),
  });

  const pill = (active: boolean) =>
    cn(
      'flex h-10 flex-1 items-center justify-center rounded-md border text-label outline-none focus-visible:shadow-focus',
      active
        ? 'border-accent bg-accent-soft font-semibold text-accent'
        : 'border-border-control bg-surface text-ink',
    );

  return (
    <DialogContent
      title={`${test.title} · ${SKILL_LABEL[section.skill]}`}
      description="Chọn chế độ và phạm vi làm bài."
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label font-semibold">Chế độ</legend>
        <div className="flex gap-2" role="radiogroup">
          {(['PRACTICE', 'EXAM'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={pill(mode === m)}
              onClick={() => setMode(m)}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="text-label-sm text-ink-muted">
          {mode === 'EXAM'
            ? 'Tính giờ theo server, hết giờ tự nộp. Listening chỉ phát một lần.'
            : 'Không tính giờ, có thể thoát và làm tiếp sau.'}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label font-semibold">Phạm vi</legend>
        <div className="flex gap-2" role="radiogroup">
          <button
            type="button"
            role="radio"
            aria-checked={effectiveScope === 'SECTION'}
            className={pill(effectiveScope === 'SECTION')}
            onClick={() => setScope('SECTION')}
          >
            Cả bài
          </button>
          {section.parts.length > 1 && (
            <button
              type="button"
              role="radio"
              aria-checked={effectiveScope === 'PART'}
              className={pill(effectiveScope === 'PART')}
              onClick={() => setScope('PART')}
            >
              Một phần
            </button>
          )}
          {canByType && (
            <button
              type="button"
              role="radio"
              aria-checked={effectiveScope === 'QUESTION_TYPE'}
              className={pill(effectiveScope === 'QUESTION_TYPE')}
              onClick={() => setScope('QUESTION_TYPE')}
            >
              Theo dạng câu
            </button>
          )}
        </div>
        {effectiveScope === 'PART' && (
          <NativeSelect aria-label="Chọn phần" value={partId} onChange={(e) => setPartId(e.target.value)}>
            {section.parts.map((p) => (
              <option key={p.id} value={p.id}>
                Part {p.number}
                {p.title ? ` — ${p.title}` : ''}
              </option>
            ))}
          </NativeSelect>
        )}
        {effectiveScope === 'QUESTION_TYPE' && (
          <div className="flex flex-col gap-2">
            {section.questionTypes.map((t) => (
              <label key={t} className="flex items-center gap-2 text-body">
                <Checkbox
                  checked={types.includes(t)}
                  onCheckedChange={(v) =>
                    setTypes((old) => (v === true ? [...old, t] : old.filter((x) => x !== t)))
                  }
                />
                {QUESTION_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button
          onClick={() => start.mutate()}
          disabled={start.isPending || (effectiveScope === 'QUESTION_TYPE' && types.length === 0)}
        >
          {start.isPending ? vi.common.loading : 'Vào bài'}
        </Button>
      </div>
    </DialogContent>
  );
}
