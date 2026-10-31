import { z } from 'zod';
import { api } from '@/lib/api-client';
import {
  AnnotationDto,
  AttemptContentDto,
  AttemptResultDto,
  AttemptStateDto,
  AttemptSummaryDto,
  AutosaveResult,
  ServerTimeDto,
  TestCardDto,
  type AutosaveBody,
  type CreateAnnotationBody,
  type ListTestsQuery,
  type StartAttemptBody,
  type SubmitBody,
} from '@/shared/attempt';
import { paginated } from '@/shared/admin';
import { BandTableDto } from '@/shared/scoring';
import {
  GradingQueueItem,
  SpeakingAttemptDto,
  WritingSaveResult,
  WritingSubmissionDto,
  type HumanSpeakingReviewBody,
  type HumanWritingReviewBody,
} from '@/shared/writing';
import { StudentTestSetDto, type ListSetsQuery } from '@/shared/test-sets';
import { qs } from './admin.service';

const StartResult = z.object({ attempt: AttemptSummaryDto, resumed: z.boolean() });
const SubmitResult = z.object({ attempt: AttemptSummaryDto, lateAnswersIgnored: z.boolean() });

export const catalogApi = {
  list: (q: Partial<ListTestsQuery>) => api(`/tests${qs(q)}`, { schema: paginated(TestCardDto) }),
  get: (id: string) => api(`/tests/${id}`, { schema: TestCardDto }),
  sets: (q: ListSetsQuery) => api(`/tests/sets${qs(q)}`, { schema: z.array(StudentTestSetDto) }),
};

export const attemptsApi = {
  start: (body: StartAttemptBody) => api('/attempts', { method: 'POST', body, schema: StartResult }),
  list: (q: { status?: string; skill?: string; page?: number; pageSize?: number }) =>
    api(`/attempts${qs(q)}`, { schema: paginated(AttemptSummaryDto) }),
  state: (id: string) => api(`/attempts/${id}`, { schema: AttemptStateDto }),
  content: (id: string) => api(`/attempts/${id}/content`, { schema: AttemptContentDto }),
  begin: (id: string) => api(`/attempts/${id}/begin`, { method: 'POST', body: {}, schema: AttemptStateDto }),
  autosave: (id: string, body: AutosaveBody) =>
    api(`/attempts/${id}/autosave`, { method: 'POST', body, schema: AutosaveResult }),
  submit: (id: string, body: SubmitBody) =>
    api(`/attempts/${id}/submit`, { method: 'POST', body, schema: SubmitResult }),
  abandon: (id: string) => api(`/attempts/${id}`, { method: 'DELETE' }),
  result: (id: string) => api(`/attempts/${id}/result`, { schema: AttemptResultDto }),
  retryWrong: (id: string) =>
    api(`/attempts/${id}/retry-wrong`, { method: 'POST', body: {}, schema: StartResult }),
  time: () => api('/time', { schema: ServerTimeDto }),
};

export const annotationsApi = {
  list: (attemptId: string) => api(`/attempts/${attemptId}/annotations`, { schema: z.array(AnnotationDto) }),
  create: (attemptId: string, body: CreateAnnotationBody) =>
    api(`/attempts/${attemptId}/annotations`, { method: 'POST', body, schema: AnnotationDto }),
  update: (id: string, body: { note?: string | null; kind?: 'HIGHLIGHT' | 'NOTE' }) =>
    api(`/annotations/${id}`, { method: 'PATCH', body, schema: AnnotationDto }),
  remove: (id: string) => api(`/annotations/${id}`, { method: 'DELETE' }),
};

export const bandTablesApi = {
  list: () => api('/band-tables', { schema: z.array(BandTableDto) }),
  history: (kind: string) => api(`/admin/band-tables/${kind}/history`, { schema: z.array(BandTableDto) }),
  update: (kind: string, body: { rows: { minRaw: number; maxRaw: number; band: number }[]; note: string }) =>
    api(`/admin/band-tables/${kind}`, { method: 'PUT', body, schema: BandTableDto }),
  reset: (kind: string) =>
    api(`/admin/band-tables/${kind}/reset`, { method: 'POST', body: {}, schema: BandTableDto }),
};

/** Fire-and-forget save while the page is being hidden/closed (keepalive survives navigation). */
export function autosaveKeepalive(id: string, body: AutosaveBody): void {
  void fetch(`/api/v1/attempts/${id}/autosave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => undefined);
}

export const writingApi = {
  list: (attemptId: string) =>
    api(`/attempts/${attemptId}/writing`, { schema: z.array(WritingSubmissionDto) }),
  save: (attemptId: string, partId: string, body: { clientSeq: number; text: string }) =>
    api(`/attempts/${attemptId}/writing/${partId}`, { method: 'PUT', body, schema: WritingSaveResult }),
  get: (id: string) => api(`/writing-submissions/${id}`, { schema: WritingSubmissionDto }),
  mine: (q: { partId?: string; page?: number; pageSize?: number }) =>
    api(`/writing-submissions${qs(q)}`, { schema: paginated(WritingSubmissionDto) }),
  checklist: (id: string, checklist: Record<string, boolean>) =>
    api(`/writing-submissions/${id}/checklist`, {
      method: 'PUT',
      body: { checklist },
      schema: WritingSubmissionDto,
    }),
  reevaluate: (id: string) =>
    api(`/writing-submissions/${id}/evaluate`, { method: 'POST', body: {}, schema: WritingSubmissionDto }),
};

export const speakingApi = {
  get: (attemptId: string) => api(`/attempts/${attemptId}/speaking`, { schema: SpeakingAttemptDto }),
  upload: (attemptId: string, form: FormData) =>
    api(`/attempts/${attemptId}/speaking/recordings`, {
      method: 'POST',
      body: form,
      schema: SpeakingAttemptDto,
    }),
  remove: (id: string) => api(`/speaking-recordings/${id}`, { method: 'DELETE' }),
};

export const gradingApi = {
  queue: (q: { kind: 'WRITING' | 'SPEAKING'; status: 'PENDING' | 'REVIEWED' | 'ALL'; page?: number }) =>
    api(`/admin/grading${qs(q)}`, { schema: paginated(GradingQueueItem) }),
  reviewWriting: (id: string, body: HumanWritingReviewBody) =>
    api(`/admin/grading/writing/${id}/reviews`, { method: 'POST', body, schema: WritingSubmissionDto }),
  reviewSpeaking: (attemptId: string, body: HumanSpeakingReviewBody) =>
    api(`/admin/grading/speaking/${attemptId}/reviews`, { method: 'POST', body, schema: SpeakingAttemptDto }),
};
