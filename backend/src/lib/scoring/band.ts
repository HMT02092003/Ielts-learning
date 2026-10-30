// Raw score → band. Tables are data (band-tables.json seeded into BandTable, admin-editable), never hard-coded.
import { z } from 'zod';
import { Band } from '../../shared/primitives';
import defaults from './band-tables.json';

export const BandRow = z.strictObject({
  minRaw: z.number().int().min(0).max(40),
  maxRaw: z.number().int().min(0).max(40),
  band: Band,
});
export const BandRows = z.array(BandRow).min(1).max(41);
export type BandRows = z.infer<typeof BandRows>;

export const DEFAULT_BAND_TABLES: {
  note: string;
  tables: Record<'LISTENING' | 'READING_ACADEMIC' | 'READING_GENERAL', BandRows>;
} = defaults;

/** Problems that make a table unusable: gaps/overlaps in 0..40 or a band that drops as the raw score rises. */
export function bandTableIssues(rows: BandRows): string[] {
  const issues: string[] = [];
  const owner = new Array<number | null>(41).fill(null);
  rows.forEach((r, i) => {
    if (r.minRaw > r.maxRaw) issues.push(`Dòng ${i + 1}: minRaw > maxRaw`);
    for (let raw = r.minRaw; raw <= r.maxRaw; raw++) {
      if (owner[raw] !== null) issues.push(`Điểm ${raw} nằm ở hai dòng`);
      owner[raw] = r.band;
    }
  });
  const missing = owner.flatMap((b, raw) => (b === null ? [raw] : []));
  if (missing.length) issues.push(`Thiếu điểm: ${missing.join(', ')}`);
  for (let raw = 1; raw <= 40; raw++) {
    const prev = owner[raw - 1];
    const cur = owner[raw];
    if (prev != null && cur != null && cur < prev)
      issues.push(`Band giảm khi điểm tăng (${raw - 1} → ${raw})`);
  }
  return [...new Set(issues)];
}

export function bandFor(rows: BandRows, raw: number): number {
  const row = rows.find((r) => raw >= r.minRaw && raw <= r.maxRaw);
  if (!row) throw new Error(`Bảng band không có điểm ${raw}`);
  return row.band;
}
