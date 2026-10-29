import { z } from 'zod';

export const Uuid = z.uuid();
export const Sha256Hex = z.string().regex(/^[a-f0-9]{64}$/, 'sha256 phải là 64 ký tự hex thường');
export const QuestionNumber = z.number().int().min(1).max(40);
export const Band = z.number().min(0).max(9).multipleOf(0.5);

/** Canonical text — annotation offsets are computed over THIS string (NFC, single spaces, trimmed). */
export function normalizeText(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Highlightable text: normalized on parse so stored offsets stay valid; idempotent. */
export const HText = (max: number) => z.string().transform(normalizeText).pipe(z.string().min(1).max(max));
/** Same, but may be empty (e.g. a table header cell). */
export const HCell = (max: number) => z.string().transform(normalizeText).pipe(z.string().max(max));
export const NormalizedText = HText(20_000);

/** A–Z option letters; tolerant on input (" b " → "B"). */
export const OptionKey = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]$/, 'Phải là 1 chữ cái A–Z');
export const ParagraphLabel = OptionKey;

/** Roman numeral heading keys i…xv (lower-case). */
export const HeadingKey = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv)$/, 'Heading key phải là số La Mã i–xv');

export const Option = z.strictObject({ key: OptionKey, text: HText(500) });
export type Option = z.infer<typeof Option>;
export const HeadingOption = z.strictObject({ key: HeadingKey, text: HText(300) });

/** Resolution-independent coordinates on an image (0..1). */
export const Point = z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export const PlacedOption = z.strictObject({ ...Option.shape, at: Point.optional() });

/** "NO MORE THAN TWO WORDS AND/OR A NUMBER" → { maxWords: 2, allowNumber: true }. */
export const WordLimit = z.strictObject({
  maxWords: z.number().int().min(0).max(5),
  allowNumber: z.boolean().default(false),
});
export type WordLimit = z.infer<typeof WordLimit>;

/** Blank marker inside prompts/templates: {{14}} = blank for question 14. */
export const BLANK_RE = /\{\{(\d{1,2})\}\}/g;
export function blankNumbers(s: string): number[] {
  return [...s.matchAll(BLANK_RE)].map((m) => Number(m[1]));
}

/** Word count shared by the writing editor (client, live) and the server (authoritative). */
export function countWords(s: string): number {
  const t = s.normalize('NFC').trim();
  if (t === '') return 0;
  return t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export const Pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
