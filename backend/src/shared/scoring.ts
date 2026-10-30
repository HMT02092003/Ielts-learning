// Band tables + result contracts (Phase 4).
import { z } from 'zod';
import { BandTableKind } from './enums';
import { Band } from './primitives';

export const BandRowDto = z.strictObject({
  minRaw: z.number().int().min(0).max(40),
  maxRaw: z.number().int().min(0).max(40),
  band: Band,
});
export type BandRowDto = z.infer<typeof BandRowDto>;

export const BandTableDto = z.object({
  id: z.uuid(),
  kind: BandTableKind,
  version: z.number(),
  name: z.string(),
  rows: z.array(BandRowDto),
  note: z.string(),
  isReference: z.boolean(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type BandTableDto = z.infer<typeof BandTableDto>;

export const BandTableKindParams = z.strictObject({ kind: BandTableKind });

export const UpdateBandTableBody = z.strictObject({
  rows: z.array(BandRowDto).min(1).max(41),
  note: z.string().trim().min(1).max(2000),
});
export type UpdateBandTableBody = z.infer<typeof UpdateBandTableBody>;

export const BAND_TABLE_LABEL: Record<z.infer<typeof BandTableKind>, string> = {
  LISTENING: 'Listening',
  READING_ACADEMIC: 'Reading (Academic)',
  READING_GENERAL: 'Reading (General Training)',
};
