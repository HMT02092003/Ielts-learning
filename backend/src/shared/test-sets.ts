// Book sets: tests grouped by (source, bookNumber) — "Cambridge 18" = CAM-18. No table; the key is derived.
import { z } from 'zod';
import { TestCardDto } from './attempt';
import { Skill, TestSource, TestStatus, TestType } from './enums';
import { ValidationIssue } from './errors';
import { Uuid } from './primitives';

const SET_KEY_RE = /^(CAM|VOL|PRE_IELTS|CUSTOM)-(none|[1-9]\d{0,3})$/;

const SOURCE_TITLE: Record<TestSource, string> = {
  CAM: 'Cambridge',
  VOL: 'Volume',
  PRE_IELTS: 'Pre-IELTS',
  CUSTOM: 'Tự soạn',
};

export function setKeyOf(source: TestSource, bookNumber: number | null): string {
  return `${source}-${bookNumber ?? 'none'}`;
}

export function parseSetKey(key: string): { source: TestSource; bookNumber: number | null } | null {
  const m = SET_KEY_RE.exec(key);
  if (!m) return null;
  return { source: m[1] as TestSource, bookNumber: m[2] === 'none' ? null : Number(m[2]) };
}

export function setTitleOf(source: TestSource, bookNumber: number | null): string {
  return bookNumber === null ? `${SOURCE_TITLE[source]} — đề lẻ` : `${SOURCE_TITLE[source]} ${bookNumber}`;
}

export const SetKeyParams = z.strictObject({ setKey: z.string().regex(SET_KEY_RE) });
export type SetKeyParams = z.infer<typeof SetKeyParams>;

export const ListSetsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  source: TestSource.optional(),
});
export type ListSetsQuery = z.infer<typeof ListSetsQuery>;

export const SetExportQuery = z.object({ include: z.enum(['latest', 'published']).default('latest') });
export type SetExportQuery = z.infer<typeof SetExportQuery>;

export const AdminSetTestDto = z.object({
  seriesKey: z.string(),
  testNumber: z.number().nullable(),
  title: z.string(),
  type: TestType,
  latest: z.object({ id: Uuid, status: TestStatus, version: z.number(), skills: z.array(Skill) }),
  published: z.object({ id: Uuid, version: z.number() }).nullable(),
});
export type AdminSetTestDto = z.infer<typeof AdminSetTestDto>;

export const AdminTestSetDto = z.object({
  setKey: z.string(),
  source: TestSource,
  bookNumber: z.number().nullable(),
  title: z.string(),
  tests: z.array(AdminSetTestDto),
  counts: z.object({ draft: z.number(), published: z.number() }),
});
export type AdminTestSetDto = z.infer<typeof AdminTestSetDto>;

export const StudentTestSetDto = z.object({
  setKey: z.string(),
  source: TestSource,
  bookNumber: z.number().nullable(),
  title: z.string(),
  tests: z.array(TestCardDto),
});
export type StudentTestSetDto = z.infer<typeof StudentTestSetDto>;

export const ZipImportItemDto = z.object({
  seriesKey: z.string().nullable(),
  file: z.string(),
  ok: z.boolean(),
  testId: Uuid.optional(),
  issues: z.array(ValidationIssue).optional(),
});
export type ZipImportItemDto = z.infer<typeof ZipImportItemDto>;

export const ZipImportResultDto = z.object({ items: z.array(ZipImportItemDto) });
export type ZipImportResultDto = z.infer<typeof ZipImportResultDto>;

export const PublishSetResultDto = z.object({
  published: z.array(z.object({ seriesKey: z.string(), testId: Uuid })),
  skipped: z.array(
    z.object({ seriesKey: z.string(), reason: z.string(), issues: z.array(ValidationIssue).optional() }),
  ),
});
export type PublishSetResultDto = z.infer<typeof PublishSetResultDto>;
