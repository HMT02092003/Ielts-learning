import { z } from 'zod';
import { api } from '@/lib/api-client';
import {
  FileDto,
  ImportResultDto,
  TestSummaryDto,
  UserAdminDto,
  paginated,
  type AdminListTestsQuery,
  type CreateUserBody,
  type HotfixQuestionBody,
  type ListUsersQuery,
  type UpdateTestMetaBody,
  type UpdateUserBody,
} from '@/shared/admin';
import { OcrJobDetailDto, OcrJobDto, type AssembleMeta, type OcrReviewDraft } from '@/shared/ocr';
import { CorrectAnswer } from '@/shared/question-types';
import {
  AdminTestSetDto,
  PublishSetResultDto,
  ZipImportResultDto,
  type ListSetsQuery,
} from '@/shared/test-sets';
import { Skill, QuestionType } from '@/shared/enums';

/** ?a=1&b=x from a plain object (undefined / '' values dropped). */
export function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const TestDetail = z.object({
  test: TestSummaryDto,
  doc: z.unknown(),
  publishIssues: z.array(z.object({ path: z.string(), code: z.string(), message: z.string() })),
});
export type TestDetail = z.infer<typeof TestDetail>;

export const AdminQuestion = z.object({
  id: z.string(),
  skill: Skill,
  number: z.number(),
  type: QuestionType,
  correctAnswer: CorrectAnswer,
  acceptedAnswers: z.array(z.string()),
  explanation: z.string().nullable(),
});
export type AdminQuestion = z.infer<typeof AdminQuestion>;

const AssembleResult = z.object({
  doc: z.unknown(),
  issues: z.array(z.object({ path: z.string(), code: z.string(), message: z.string() })),
});

export const usersApi = {
  list: (q: Partial<ListUsersQuery>) => api(`/admin/users${qs(q)}`, { schema: paginated(UserAdminDto) }),
  create: (body: CreateUserBody) => api('/admin/users', { method: 'POST', body, schema: UserAdminDto }),
  update: (id: string, body: UpdateUserBody) =>
    api(`/admin/users/${id}`, { method: 'PATCH', body, schema: UserAdminDto }),
  resetPassword: (id: string, newPassword: string) =>
    api(`/admin/users/${id}/reset-password`, { method: 'POST', body: { newPassword } }),
};

export const testsAdminApi = {
  list: (q: Partial<AdminListTestsQuery>) =>
    api(`/admin/tests${qs(q)}`, { schema: paginated(TestSummaryDto) }),
  get: (id: string) => api(`/admin/tests/${id}`, { schema: TestDetail }),
  questions: (id: string) => api(`/admin/tests/${id}/questions`, { schema: z.array(AdminQuestion) }),
  importFiles: (files: File[], dryRun: boolean) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    return api(dryRun ? '/admin/tests/import/validate' : '/admin/tests/import', {
      method: 'POST',
      body: fd,
      schema: ImportResultDto,
    });
  },
  replaceContent: (id: string, doc: unknown) =>
    api(`/admin/tests/${id}/content`, { method: 'PUT', body: { doc }, schema: ImportResultDto }),
  updateMeta: (id: string, body: UpdateTestMetaBody) =>
    api(`/admin/tests/${id}`, { method: 'PATCH', body, schema: TestSummaryDto }),
  publish: (id: string) =>
    api(`/admin/tests/${id}/publish`, { method: 'POST', body: {}, schema: TestSummaryDto }),
  unpublish: (id: string) =>
    api(`/admin/tests/${id}/unpublish`, { method: 'POST', body: {}, schema: TestSummaryDto }),
  clone: (id: string) =>
    api(`/admin/tests/${id}/clone`, { method: 'POST', body: {}, schema: ImportResultDto }),
  remove: (id: string) => api(`/admin/tests/${id}`, { method: 'DELETE' }),
  hotfix: (id: string, questionId: string, body: HotfixQuestionBody) =>
    api(`/admin/tests/${id}/questions/${questionId}`, { method: 'PATCH', body }),
};

export const testSetsAdminApi = {
  list: (q: ListSetsQuery) => api(`/admin/test-sets${qs(q)}`, { schema: z.array(AdminTestSetDto) }),
  publish: (setKey: string) =>
    api(`/admin/test-sets/${setKey}/publish`, { method: 'POST', body: {}, schema: PublishSetResultDto }),
  importZip: (file: File, dryRun: boolean) => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return api(dryRun ? '/admin/tests/import-zip/validate' : '/admin/tests/import-zip', {
      method: 'POST',
      body: fd,
      schema: ZipImportResultDto,
    });
  },
};

/** Download links (plain <a href download>; the API streams the zip with auth cookies). */
export const exportUrl = {
  test: (id: string) => `/api/v1/admin/tests/${id}/export.zip`,
  set: (setKey: string, include: 'latest' | 'published' = 'latest') =>
    `/api/v1/admin/test-sets/${setKey}/export.zip${qs({ include })}`,
};

export const filesApi = {
  upload: (file: File, purpose: 'TEST_AUDIO' | 'TEST_IMAGE') => {
    const fd = new FormData();
    fd.append('purpose', purpose);
    fd.append('file', file, file.name);
    return api('/admin/files', { method: 'POST', body: fd, schema: FileDto });
  },
  list: (q: { purpose?: string; page?: number }) =>
    api(`/admin/files${qs(q)}`, { schema: paginated(FileDto) }),
  remove: (id: string) => api(`/admin/files/${id}`, { method: 'DELETE', body: {} }),
};

export const ocrApi = {
  list: (page = 1) => api(`/admin/ocr-jobs${qs({ page })}`, { schema: paginated(OcrJobDto) }),
  create: (files: File[], title?: string) => {
    const fd = new FormData();
    if (title) fd.append('title', title);
    for (const f of files) fd.append('files', f, f.name);
    return api('/admin/ocr-jobs', { method: 'POST', body: fd, schema: OcrJobDto });
  },
  get: (id: string) => api(`/admin/ocr-jobs/${id}`, { schema: OcrJobDetailDto }),
  saveReview: (id: string, draftVersion: number, draft: OcrReviewDraft) =>
    api(`/admin/ocr-jobs/${id}/review`, {
      method: 'PUT',
      body: { draftVersion, draft },
      schema: z.object({ draftVersion: z.number() }),
    }),
  rotate: (id: string, pageId: string, rotation: 0 | 90 | 180 | 270) =>
    api(`/admin/ocr-jobs/${id}/pages/${pageId}/rotate`, {
      method: 'POST',
      body: { rotation },
      schema: OcrJobDetailDto,
    }),
  approvePage: (id: string, pageId: string) =>
    api(`/admin/ocr-jobs/${id}/pages/${pageId}/approve`, { method: 'POST', body: {} }),
  assemble: (id: string, meta: AssembleMeta) =>
    api(`/admin/ocr-jobs/${id}/assemble`, { method: 'POST', body: meta, schema: AssembleResult }),
  publish: (id: string, publishNow: boolean) =>
    api(`/admin/ocr-jobs/${id}/publish`, {
      method: 'POST',
      body: { publishNow },
      schema: z.object({ testId: z.string() }),
    }),
  retry: (id: string) => api(`/admin/ocr-jobs/${id}/retry`, { method: 'POST', body: {}, schema: OcrJobDto }),
  remove: (id: string) => api(`/admin/ocr-jobs/${id}`, { method: 'DELETE' }),
};

/** URL of a stored file (served by the API with auth + Range). */
export const fileUrl = (id: string) => `/api/v1/files/${id}`;
