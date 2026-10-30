// Study/exam labels shared by the practice library, results, history and stats pages.
import type { QuestionType, Skill } from '@/shared/enums';

export const SKILL_LABEL: Record<Skill, string> = {
  LISTENING: 'Listening',
  READING: 'Reading',
  WRITING: 'Writing',
  SPEAKING: 'Speaking',
};

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Trắc nghiệm 1 đáp án',
  MULTIPLE_CHOICE_MULTI: 'Trắc nghiệm nhiều đáp án',
  TRUE_FALSE_NOT_GIVEN: 'True / False / Not Given',
  YES_NO_NOT_GIVEN: 'Yes / No / Not Given',
  MATCHING_HEADINGS: 'Nối tiêu đề',
  MATCHING_INFORMATION: 'Nối thông tin với đoạn',
  MATCHING_FEATURES: 'Nối đặc điểm',
  SENTENCE_COMPLETION: 'Hoàn thành câu',
  SUMMARY_COMPLETION: 'Hoàn thành tóm tắt',
  NOTE_TABLE_FLOWCHART_COMPLETION: 'Hoàn thành ghi chú / bảng / sơ đồ',
  SHORT_ANSWER: 'Trả lời ngắn',
  MAP_DIAGRAM_LABELLING: 'Điền nhãn bản đồ / sơ đồ',
};

export const MODE_LABEL = { EXAM: 'Thi thử', PRACTICE: 'Luyện tập' } as const;

export const STATUS_LABEL = {
  CREATED: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang làm',
  SUBMITTED: 'Đã nộp',
  EXPIRED: 'Hết giờ — tự nộp',
  ABANDONED: 'Đã bỏ',
} as const;

export const fmtDuration = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} phút` : `${Math.floor(m / 60)} giờ ${m % 60} phút`;
};

export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
