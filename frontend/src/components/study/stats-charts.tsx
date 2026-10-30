'use client';

// Study charts (C-Dashboard). Each chart shows ONE series at a time (skill picked with a segmented control), so
// identity never depends on colour; values are always printed in ink, never in the series colour.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardLabel } from '@/components/ui/card';
import { SKILL_LABEL } from '@/i18n/vi-exam';
import { cn } from '@/lib/cn';
import { statsApi } from '@/services/study.service';
import type { Skill } from '@/shared/enums';
import type { SkillBand } from '@/shared/study';

const SERIES: Record<string, string> = {
  OVERALL: 'var(--series-overall)',
  LISTENING: 'var(--series-listening)',
  READING: 'var(--series-reading)',
  WRITING: 'var(--series-writing)',
  SPEAKING: 'var(--series-speaking)',
};

const fmtDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Four horizontal band bars (0–9) with a target marker; "chưa có" when no band yet. */
export function SkillBandBars({ skills, target }: { skills: SkillBand[]; target: number | null }) {
  return (
    <ul className="flex flex-col gap-3">
      {skills.map((s) => (
        <li key={s.skill} className="grid grid-cols-[84px_1fr_40px] items-center gap-3">
          <span className="text-label font-medium">{SKILL_LABEL[s.skill]}</span>
          <div className="relative h-2 rounded-full bg-track">
            {s.band !== null && (
              <div className="h-full rounded-full bg-accent" style={{ width: `${(s.band / 9) * 100}%` }} />
            )}
            {target !== null && (
              <span
                aria-hidden
                className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink"
                style={{ left: `calc(${(target / 9) * 100}% - 1px)` }}
              />
            )}
          </div>
          <span className="text-right font-tabular text-body font-semibold">
            {s.band !== null ? s.band.toFixed(1) : <span className="font-normal text-ink-subtle">—</span>}
          </span>
        </li>
      ))}
      {target !== null && (
        <li className="flex items-center gap-2 text-label-sm text-ink-muted">
          <span aria-hidden className="h-3 w-0.5 rounded-full bg-ink" /> Vạch mục tiêu {target.toFixed(1)}
        </li>
      )}
    </ul>
  );
}

const TREND_OPTIONS = ['OVERALL', 'LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const;

export function BandTrendCard({ target }: { target: number | null }) {
  const [skill, setSkill] = useState<(typeof TREND_OPTIONS)[number]>('OVERALL');
  const [range, setRange] = useState<'4w' | '8w' | 'all'>('8w');
  const trend = useQuery({
    queryKey: ['stats', 'trend', skill, range],
    queryFn: () => statsApi.bandTrend({ skill, range }),
  });
  const points = trend.data?.points ?? [];
  const bands = points.map((p) => p.band).concat(target !== null ? [target] : []);
  const lo = bands.length ? Math.max(0, Math.floor(Math.min(...bands)) - 1) : 4;
  const hi = bands.length ? Math.min(9, Math.ceil(Math.max(...bands)) + 1) : 9;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <CardLabel className="flex-1">Band theo thời gian</CardLabel>
        <div role="radiogroup" aria-label="Kỹ năng" className="flex rounded-lg bg-surface-muted p-0.5">
          {TREND_OPTIONS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={skill === k}
              onClick={() => setSkill(k)}
              className={cn(
                'h-8 rounded-md px-2.5 text-label-sm',
                skill === k ? 'bg-surface font-semibold shadow-xs' : 'text-ink-muted',
              )}
            >
              {k === 'OVERALL' ? 'Overall' : SKILL_LABEL[k as Skill].slice(0, 1)}
            </button>
          ))}
        </div>
        <div
          role="radiogroup"
          aria-label="Khoảng thời gian"
          className="flex rounded-lg bg-surface-muted p-0.5"
        >
          {(['4w', '8w', 'all'] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              onClick={() => setRange(r)}
              className={cn(
                'h-8 rounded-md px-2.5 text-label-sm',
                range === r ? 'bg-surface font-semibold shadow-xs' : 'text-ink-muted',
              )}
            >
              {r === 'all' ? 'Tất cả' : r === '4w' ? '4 tuần' : '8 tuần'}
            </button>
          ))}
        </div>
      </div>
      {points.length === 0 ? (
        <p className="py-10 text-center text-body text-ink-muted">
          {skill === 'OVERALL'
            ? 'Cần band của đủ 4 kỹ năng (Writing/Speaking do giám khảo chấm) để vẽ Overall.'
            : 'Chưa có band nào cho kỹ năng này trong khoảng thời gian đã chọn.'}
        </p>
      ) : (
        <div
          className="h-56"
          role="img"
          aria-label={`Band ${skill === 'OVERALL' ? 'Overall' : SKILL_LABEL[skill as Skill]}: ${points.map((p) => `${fmtDay(p.date)} ${p.band}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--divider)" />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDay}
                tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
              />
              <YAxis
                domain={[lo, hi]}
                ticks={Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)}
                tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              {target !== null && (
                <ReferenceLine
                  y={target}
                  stroke="var(--ink-muted)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Mục tiêu ${target.toFixed(1)}`,
                    fill: 'var(--ink-muted)',
                    fontSize: 12,
                    position: 'insideTopRight',
                  }}
                />
              )}
              <Tooltip
                cursor={{ stroke: 'var(--border-strong)' }}
                contentStyle={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--ink)',
                  fontSize: 13,
                }}
                labelFormatter={(d) => fmtDay(String(d))}
                formatter={(v) => [Number(v).toFixed(1), 'Band']}
              />
              <Line
                type="linear"
                dataKey="band"
                stroke={SERIES[skill]}
                strokeWidth={2}
                dot={{ r: 4, fill: SERIES[skill], stroke: 'var(--surface)', strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/** Study minutes per day, 26 weeks (columns = weeks, rows = Mon..Sun). Level is also in the cell's label. */
export function StreakHeatmap() {
  const heat = useQuery({ queryKey: ['stats', 'heatmap'], queryFn: () => statsApi.heatmap(182) });
  const days = heat.data?.days ?? [];
  if (days.length === 0) return null;
  const firstDow = (new Date(`${days[0]?.date ?? ''}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: ({ date: string; minutes: number; level: number } | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...days,
  ];
  const bg = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3'];
  return (
    <div className="flex flex-col gap-2">
      <div
        className="grid grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto"
        role="img"
        aria-label="Số phút học mỗi ngày trong 26 tuần gần đây"
      >
        {cells.map((c, i) =>
          c ? (
            <span
              key={c.date}
              title={`${fmtDay(c.date)}: ${c.minutes} phút`}
              className={cn('size-3 rounded-[3px]', bg[c.level])}
            />
          ) : (
            <span key={`pad-${i}`} className="size-3" />
          ),
        )}
      </div>
      <div className="flex items-center gap-1.5 text-caption text-ink-muted">
        Ít
        {bg.map((b) => (
          <span key={b} aria-hidden className={cn('size-3 rounded-[3px]', b)} />
        ))}
        Nhiều · 0 / 1–19 / 20–44 / ≥ 45 phút
      </div>
    </div>
  );
}

/** Radar of the four skills (M9: W/S only from a human grader). The numbers are listed too. */
export function SkillRadarCard() {
  const radar = useQuery({ queryKey: ['stats', 'radar'], queryFn: statsApi.radar });
  const skills = radar.data?.skills ?? [];
  const data = skills.map((s) => ({ skill: SKILL_LABEL[s.skill], band: s.band ?? 0 }));
  return (
    <Card className="grid gap-4 md:grid-cols-[1fr_220px]">
      <div
        className="h-60"
        role="img"
        aria-label={`Band 4 kỹ năng: ${skills.map((s) => `${SKILL_LABEL[s.skill]} ${s.band ?? 'chưa có'}`).join(', ')}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="var(--divider)" />
            <PolarAngleAxis dataKey="skill" tick={{ fill: 'var(--ink-secondary)', fontSize: 12 }} />
            <PolarRadiusAxis
              domain={[0, 9]}
              tickCount={4}
              tick={{ fill: 'var(--ink-subtle)', fontSize: 11 }}
              axisLine={false}
            />
            <Radar
              dataKey="band"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="var(--accent)"
              fillOpacity={0.18}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-2">
        <CardLabel>4 kỹ năng (band gần nhất)</CardLabel>
        <ul className="flex flex-col gap-1.5 text-body">
          {skills.map((s) => (
            <li key={s.skill} className="flex justify-between">
              <span>{SKILL_LABEL[s.skill]}</span>
              <span className="font-tabular font-semibold">{s.band?.toFixed(1) ?? '—'}</span>
            </li>
          ))}
        </ul>
        <p className="text-label-sm text-ink-muted">
          Writing/Speaking chỉ tính điểm giám khảo chấm, không tính ước lượng máy.
        </p>
      </div>
    </Card>
  );
}
