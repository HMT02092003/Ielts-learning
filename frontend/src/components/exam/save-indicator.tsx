'use client';

import { useExamStore } from '@/stores/exam-store';

/** "Đã lưu · HH:MM" / "Đang lưu…" / save error (never colour alone: the text says it). */
export function SaveIndicator() {
  const lastSavedAt = useExamStore((x) => x.lastSavedAt);
  const error = useExamStore((x) => x.saveError);
  const dirty = useExamStore((x) => x.revision !== x.savedRevision);
  if (error)
    return (
      <span role="status" className="text-label-sm text-danger">
        Chưa lưu được — đang thử lại
      </span>
    );
  if (dirty) return <span className="text-label-sm text-ink-muted">Đang lưu…</span>;
  if (!lastSavedAt) return null;
  const t = new Date(lastSavedAt);
  return (
    <span className="text-label-sm text-ink-muted">
      Đã lưu · {String(t.getHours()).padStart(2, '0')}:{String(t.getMinutes()).padStart(2, '0')}
    </span>
  );
}
