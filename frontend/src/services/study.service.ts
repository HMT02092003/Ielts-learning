import { z } from 'zod';
import { api } from '@/lib/api-client';
import { paginated } from '@/shared/admin';
import {
  BandTrendDto,
  DashboardDto,
  DictionaryEntryDto,
  HeatmapDto,
  RadarDto,
  ReviewQueueDto,
  VocabularyDto,
  type CreateVocabularyBody,
  type ReviewGrade,
  type UpdateVocabularyBody,
} from '@/shared/study';
import { qs } from './admin.service';

export const statsApi = {
  dashboard: () => api('/stats/dashboard', { schema: DashboardDto }),
  bandTrend: (q: { skill: string; range: '4w' | '8w' | 'all' }) =>
    api(`/stats/band-trend${qs(q)}`, { schema: BandTrendDto }),
  heatmap: (days = 182) => api(`/stats/heatmap${qs({ days })}`, { schema: HeatmapDto }),
  radar: () => api('/stats/radar', { schema: RadarDto }),
  mark: (seriesKey: string, body: { done?: boolean; hidden?: boolean }) =>
    api(`/me/tests/${seriesKey}/mark`, {
      method: 'PUT',
      body,
      schema: z.object({ seriesKey: z.string(), done: z.boolean(), hidden: z.boolean() }),
    }),
};

export const vocabApi = {
  list: (q: { page?: number; pageSize?: number; q?: string; state?: string; due?: string }) =>
    api(`/vocabulary${qs(q)}`, { schema: paginated(VocabularyDto) }),
  create: (body: CreateVocabularyBody) => api('/vocabulary', { method: 'POST', body, schema: VocabularyDto }),
  update: (id: string, body: UpdateVocabularyBody) =>
    api(`/vocabulary/${id}`, { method: 'PATCH', body, schema: VocabularyDto }),
  remove: (id: string) => api(`/vocabulary/${id}`, { method: 'DELETE' }),
  queue: (pageSize = 50) => api(`/vocabulary/review-queue${qs({ pageSize })}`, { schema: ReviewQueueDto }),
  review: (id: string, grade: ReviewGrade, clientReviewId: string) =>
    api(`/vocabulary/${id}/review`, {
      method: 'POST',
      body: { grade, clientReviewId },
      schema: VocabularyDto,
    }),
};

export const dictionaryApi = {
  lookup: (term: string) => api(`/dictionary/lookup${qs({ term })}`, { schema: DictionaryEntryDto }),
};
