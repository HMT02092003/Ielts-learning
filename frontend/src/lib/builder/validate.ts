// Live validation with the same rules the server uses (shared Zod schema + publish checks).
import { zodIssues } from '@/shared/errors';
import { checkPublishable, TestImportDoc } from '@/shared/test-import';
import type { Doc } from './types';

export interface BuilderIssue {
  path: string;
  message: string;
  /** draft = blocks saving; publish = can save as draft but not publish yet. */
  level: 'draft' | 'publish';
}

export interface Validation {
  issues: BuilderIssue[];
  canSave: boolean;
  canPublish: boolean;
}

type RawIssue = {
  code: string;
  path: PropertyKey[];
  message: string;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  input?: unknown;
  values?: unknown[];
};

const FIELD_EMPTY: Record<string, string> = {
  answer: 'Chưa có đáp án',
  prompt: 'Chưa nhập nội dung câu hỏi',
  text: 'Chưa nhập nội dung',
  title: 'Chưa nhập tiêu đề',
  stem: 'Chưa nhập câu dẫn',
  instructions: 'Chưa nhập hướng dẫn',
  topic: 'Chưa nhập chủ đề',
  file: 'Chưa tải file lên',
  image: 'Chưa tải ảnh lên',
};

/** Zod's English defaults → short Vietnamese messages; our own (Vietnamese) messages are kept. */
export function friendlyMessage(i: RawIssue): string {
  const field = String([...i.path].reverse().find((p) => typeof p === 'string') ?? '');
  const n = (v: number | bigint | undefined) => Number(v ?? 0);
  switch (i.code) {
    case 'too_small':
      if (i.origin === 'string')
        return n(i.minimum) <= 1 ? (FIELD_EMPTY[field] ?? 'Chưa nhập') : `Cần ít nhất ${n(i.minimum)} ký tự`;
      if (i.origin === 'array') return `Cần ít nhất ${n(i.minimum)} mục`;
      return `Tối thiểu là ${n(i.minimum)}`;
    case 'too_big':
      if (i.origin === 'string') return `Dài quá ${n(i.maximum)} ký tự`;
      if (i.origin === 'array') return `Tối đa ${n(i.maximum)} mục`;
      return `Tối đa là ${n(i.maximum)}`;
    case 'invalid_type':
      return i.input === undefined
        ? (FIELD_EMPTY[field] ?? 'Còn thiếu thông tin bắt buộc')
        : 'Giá trị không hợp lệ';
    case 'invalid_value':
      return field === 'answer' ? 'Chưa chọn đáp án' : `Phải là một trong: ${(i.values ?? []).join(', ')}`;
    case 'invalid_union':
      return FIELD_EMPTY[field] ?? 'Giá trị không hợp lệ';
    case 'invalid_format':
      return /^Invalid/.test(i.message) ? 'Sai định dạng' : i.message;
    case 'unrecognized_keys':
      return 'Có trường không được hỗ trợ (sửa trong JSON)';
    default:
      return i.message;
  }
}

export function validateDoc(doc: Doc): Validation {
  const parsed = TestImportDoc.safeParse(doc);
  if (!parsed.success) {
    const raw = parsed.error.issues as unknown as RawIssue[];
    const issues = zodIssues(parsed.error).map((i, k) => ({
      path: i.path,
      message: raw[k] ? friendlyMessage(raw[k]) : i.message,
      level: 'draft' as const,
    }));
    return { issues, canSave: false, canPublish: false };
  }
  const issues = checkPublishable(parsed.data).map((i) => ({
    path: i.path,
    message: i.message,
    level: 'publish' as const,
  }));
  return { issues, canSave: true, canPublish: issues.length === 0 };
}

/** Issues at or below `prefix` ("" = all). */
export function issuesUnder(issues: BuilderIssue[], prefix: string): BuilderIssue[] {
  if (!prefix) return issues;
  return issues.filter(
    (i) => i.path === prefix || i.path.startsWith(`${prefix}.`) || i.path.startsWith(`${prefix}[`),
  );
}

/** "reading.passages[1].groups[0].questions[2].answer" → "Reading › Passage 2 › Nhóm 1 › Câu thứ 3 › answer". */
export function humanPath(path: string): string {
  if (!path) return 'Đề';
  const parts: string[] = [];
  const re = /([a-zA-Z]+)(?:\[(\d+)\])?/g;
  for (const m of path.matchAll(re)) {
    const [, key, idx] = m;
    const n = idx !== undefined ? Number(idx) + 1 : undefined;
    switch (key) {
      case 'reading':
        parts.push('Reading');
        break;
      case 'listening':
        parts.push('Listening');
        break;
      case 'writing':
        parts.push('Writing');
        break;
      case 'speaking':
        parts.push('Speaking');
        break;
      case 'passages':
        parts.push(n ? `Passage ${n}` : 'Passages');
        break;
      case 'parts':
        parts.push(n ? `Part ${n}` : 'Parts');
        break;
      case 'tasks':
        parts.push(n ? `Task ${n}` : 'Tasks');
        break;
      case 'groups':
        parts.push(n ? `Nhóm ${n}` : 'Nhóm');
        break;
      case 'questions':
        parts.push(n ? `Câu thứ ${n}` : 'Câu hỏi');
        break;
      case 'paragraphs':
        parts.push(n ? `Đoạn ${n}` : 'Đoạn');
        break;
      default:
        parts.push(n ? `${key} ${n}` : key!);
    }
  }
  return parts.join(' › ');
}
