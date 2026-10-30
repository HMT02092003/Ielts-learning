// GENERATED from backend/src/shared by scripts/sync-shared.mjs — DO NOT EDIT.
// Admin API contracts (Phase 2): users, tests, files. Shared with the frontend via sync-shared.
import { z } from 'zod';
import { IsoDate } from './auth';
import { FilePurpose, Role, Skill, TestSource, TestStatus, TestType } from './enums';
import { Band, Pagination, Uuid } from './primitives';

// ───── Pagination ─────
export const PageQuery = Pagination;
export type PageQuery = z.infer<typeof PageQuery>;

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), page: z.number(), pageSize: z.number(), total: z.number() });
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export const IdParams = z.strictObject({ id: Uuid });
export type IdParams = z.infer<typeof IdParams>;

/** "true"/"false" query flags. */
const QueryBool = z.enum(['true', 'false']).transform((v) => v === 'true');

// ───── Users ─────
export const UserAdminDto = z.object({
  id: Uuid,
  email: z.string(),
  displayName: z.string(),
  role: Role,
  isActive: z.boolean(),
  targetBand: Band.nullable(),
  examDate: IsoDate.nullable(),
  lastLoginAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type UserAdminDto = z.infer<typeof UserAdminDto>;

export const ListUsersQuery = PageQuery.extend({
  q: z.string().trim().max(100).optional(),
  role: Role.optional(),
  isActive: QueryBool.optional(),
});
export type ListUsersQuery = z.infer<typeof ListUsersQuery>;

export const CreateUserBody = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  displayName: z.string().trim().min(1).max(80),
  role: Role.default('STUDENT'),
  password: z.string().min(8).max(128),
  targetBand: Band.nullable().optional(),
  examDate: IsoDate.nullable().optional(),
});
export type CreateUserBody = z.infer<typeof CreateUserBody>;

export const UpdateUserBody = z.strictObject({
  displayName: z.string().trim().min(1).max(80).optional(),
  role: Role.optional(),
  isActive: z.boolean().optional(),
  targetBand: Band.nullable().optional(),
  examDate: IsoDate.nullable().optional(),
});
export type UpdateUserBody = z.infer<typeof UpdateUserBody>;

export const ResetPasswordBody = z.strictObject({ newPassword: z.string().min(8).max(128) });
export type ResetPasswordBody = z.infer<typeof ResetPasswordBody>;

// ───── Tests ─────
export const SectionSummary = z.object({ skill: Skill, questions: z.number(), parts: z.number() });

export const TestSummaryDto = z.object({
  id: Uuid,
  seriesKey: z.string(),
  version: z.number(),
  status: TestStatus,
  source: TestSource,
  type: TestType,
  title: z.string(),
  sourceRef: z.string().nullable(),
  bookNumber: z.number().nullable(),
  testNumber: z.number().nullable(),
  sections: z.array(SectionSummary),
  attemptCount: z.number(),
  publishedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
});
export type TestSummaryDto = z.infer<typeof TestSummaryDto>;

export const AdminListTestsQuery = PageQuery.extend({
  q: z.string().trim().max(100).optional(),
  source: TestSource.optional(),
  type: TestType.optional(),
  status: TestStatus.optional(),
  skill: Skill.optional(),
});
export type AdminListTestsQuery = z.infer<typeof AdminListTestsQuery>;

export const UpdateTestMetaBody = z.strictObject({
  title: z.string().trim().min(1).max(300).optional(),
  source: TestSource.optional(),
  type: TestType.optional(),
  sourceRef: z.string().trim().max(300).nullable().optional(),
  bookNumber: z.number().int().positive().nullable().optional(),
  testNumber: z.number().int().positive().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});
export type UpdateTestMetaBody = z.infer<typeof UpdateTestMetaBody>;

/** Replace the content of a DRAFT test with an import document (the JSON editor). */
export const ReplaceTestContentBody = z.strictObject({ doc: z.unknown() });
export type ReplaceTestContentBody = z.infer<typeof ReplaceTestContentBody>;

/** Hotfix on a PUBLISHED test (M1): only answer variants and explanation. */
export const HotfixQuestionBody = z.strictObject({
  acceptedAnswers: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  explanation: z.string().max(4000).nullable().optional(),
});
export type HotfixQuestionBody = z.infer<typeof HotfixQuestionBody>;

export const ImportResultDto = z.object({
  valid: z.boolean(),
  testId: Uuid.optional(),
  summary: z.object({ sections: z.array(SectionSummary) }).optional(),
});
export type ImportResultDto = z.infer<typeof ImportResultDto>;

// ───── Files ─────
export const FileDto = z.object({
  id: Uuid,
  purpose: FilePurpose,
  mimeType: z.string(),
  originalName: z.string().nullable(),
  sizeBytes: z.number(),
  widthPx: z.number().nullable(),
  heightPx: z.number().nullable(),
  durationMs: z.number().nullable(),
  createdAt: z.iso.datetime(),
});
export type FileDto = z.infer<typeof FileDto>;

export const UploadFileBody = z.strictObject({ purpose: z.enum(['TEST_AUDIO', 'TEST_IMAGE']) });
export type UploadFileBody = z.infer<typeof UploadFileBody>;
