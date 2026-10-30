'use client';

// Admin band tables (spec §6 P4, M2): every edit creates a new version (old attempts keep theirs), reset returns to
// the reference table. Rows must cover raw 0–40 without gaps or overlaps (checked again on the server).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardLabel } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { vi } from '@/i18n/vi';
import { fmtDateTime } from '@/i18n/vi-exam';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { bandTablesApi } from '@/services/exam.service';
import { BAND_TABLE_LABEL, type BandRowDto, type BandTableDto } from '@/shared/scoring';

type Kind = BandTableDto['kind'];

function issuesOf(rows: BandRowDto[]): string[] {
  const out: string[] = [];
  const sorted = [...rows].sort((a, b) => a.minRaw - b.minRaw);
  let next = 0;
  for (const r of sorted) {
    if (r.minRaw > r.maxRaw) out.push(`Dòng ${r.minRaw}–${r.maxRaw}: điểm đầu lớn hơn điểm cuối`);
    if (r.minRaw > next) out.push(`Thiếu điểm ${next}–${r.minRaw - 1}`);
    if (r.minRaw < next) out.push(`Trùng điểm ở ${r.minRaw}`);
    if (r.band < 0 || r.band > 9 || (r.band * 2) % 1 !== 0)
      out.push(`Band ${r.band} không hợp lệ (0–9, bước 0.5)`);
    next = Math.max(next, r.maxRaw + 1);
  }
  if (next <= 40) out.push(`Thiếu điểm ${next}–40`);
  return out;
}

export default function BandTablesPage() {
  const tables = useQuery({ queryKey: ['band-tables'], queryFn: bandTablesApi.list });
  const [kind, setKind] = useState<Kind>('READING_ACADEMIC');
  if (tables.isError) return <ErrorState onRetry={() => void tables.refetch()} />;
  if (!tables.data) return <p className="text-body text-ink-muted">{vi.common.loading}</p>;
  const active = tables.data.find((t) => t.kind === kind);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold">Bảng quy đổi band</h1>
        <p className="text-body text-ink-muted">
          Bảng tham khảo, không phải bảng chính thức. Mỗi lần lưu tạo phiên bản mới; bài đã chấm giữ phiên bản
          cũ.
        </p>
      </div>
      <div role="tablist" className="flex gap-1 self-start rounded-lg bg-surface-muted p-0.5">
        {(Object.keys(BAND_TABLE_LABEL) as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              'h-9 rounded-md px-3 text-label',
              kind === k ? 'bg-surface font-semibold shadow-xs' : 'text-ink-muted',
            )}
          >
            {BAND_TABLE_LABEL[k]}
          </button>
        ))}
      </div>
      {active ? (
        <Editor key={active.id} table={active} />
      ) : (
        <p className="text-body text-ink-muted">Chưa có bảng.</p>
      )}
    </div>
  );
}

function Editor({ table }: { table: BandTableDto }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<BandRowDto[]>(() => [...table.rows].sort((a, b) => b.minRaw - a.minRaw));
  const [note, setNote] = useState(table.note);
  const history = useQuery({
    queryKey: ['band-tables', table.kind, 'history'],
    queryFn: () => bandTablesApi.history(table.kind),
  });
  const issues = issuesOf(rows);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['band-tables'] });
  const save = useMutation({
    mutationFn: () => bandTablesApi.update(table.kind, { rows, note }),
    onSuccess: (t) => {
      toast.success(`Đã lưu phiên bản ${t.version}`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không lưu được'),
  });
  const reset = useMutation({
    mutationFn: () => bandTablesApi.reset(table.kind),
    onSuccess: (t) => {
      toast.success(`Đã khôi phục bảng tham khảo (phiên bản ${t.version})`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không khôi phục được'),
  });
  const set = (i: number, patch: Partial<BandRowDto>) =>
    setRows((old) => old.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CardLabel className="flex-1">
            Phiên bản {table.version} {table.isReference && <Badge variant="info">Tham khảo</Badge>}
          </CardLabel>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRows((o) => [...o, { minRaw: 0, maxRaw: 0, band: 0 }])}
          >
            <Plus className="size-4" aria-hidden /> Thêm dòng
          </Button>
        </div>
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-label text-ink-muted">
              <th className="py-2 font-medium">Từ (câu đúng)</th>
              <th className="py-2 font-medium">Đến</th>
              <th className="py-2 font-medium">Band</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <Input
                    aria-label="Từ"
                    type="number"
                    min={0}
                    max={40}
                    value={r.minRaw}
                    onChange={(e) => set(i, { minRaw: Number(e.target.value) })}
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    aria-label="Đến"
                    type="number"
                    min={0}
                    max={40}
                    value={r.maxRaw}
                    onChange={(e) => set(i, { maxRaw: Number(e.target.value) })}
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    aria-label="Band"
                    type="number"
                    min={0}
                    max={9}
                    step={0.5}
                    value={r.band}
                    onChange={(e) => set(i, { band: Number(e.target.value) })}
                  />
                </td>
                <td className="py-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Xóa dòng"
                    onClick={() => setRows((o) => o.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <label className="flex flex-col gap-1.5 text-label">
          Ghi chú (nguồn / lý do sửa)
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </label>
        {issues.length > 0 && (
          <ul
            role="alert"
            className="flex flex-col gap-1 rounded-lg bg-danger-soft px-3 py-2 text-label-sm text-danger"
          >
            {issues.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Button
            onClick={() => save.mutate()}
            disabled={issues.length > 0 || !note.trim() || save.isPending}
          >
            Lưu phiên bản mới
          </Button>
          <Button variant="secondary" onClick={() => reset.mutate()} disabled={reset.isPending}>
            Khôi phục bảng tham khảo
          </Button>
        </div>
      </Card>
      <Card className="flex flex-col gap-3">
        <CardLabel>Lịch sử phiên bản</CardLabel>
        <ul className="flex flex-col gap-2 text-body">
          {history.data?.map((h) => (
            <li key={h.id} className="flex flex-col">
              <span className="font-medium">
                v{h.version} {h.active && <Badge variant="success">Đang dùng</Badge>}
              </span>
              <span className="text-label-sm text-ink-muted">
                {fmtDateTime(h.createdAt)} · {h.note}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
