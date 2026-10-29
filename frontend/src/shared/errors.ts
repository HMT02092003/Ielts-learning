// GENERATED from backend/src/shared by scripts/sync-shared.mjs — DO NOT EDIT.
import { z } from 'zod';

/** Single source of truth for API error codes → HTTP status. */
export const ERROR_CATALOG = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_REFRESH_INVALID: 401,
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_ACCOUNT_DISABLED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LAST_ADMIN: 409,
  TEST_LOCKED: 409,
  ATTEMPT_DEADLINE_PASSED: 409,
  ATTEMPT_NOT_SUBMITTED: 409,
  OCR_JOB_NOT_READY: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  FILE_SIGNATURE_MISMATCH: 415,
  IMPORT_INVALID: 422,
  TEST_NOT_PUBLISHABLE: 422,
  RATE_LIMITED: 429,
  CONTENT_INVALID: 500,
  INTERNAL: 500,
  UPSTREAM_UNAVAILABLE: 502,
  UPSTREAM_TIMEOUT: 504,
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOG;
export const ErrorCode = z.enum(Object.keys(ERROR_CATALOG) as [ErrorCode, ...ErrorCode[]]);

export const ValidationIssue = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
});
export type ValidationIssue = z.infer<typeof ValidationIssue>;

/** Uniform error body (spec §2): { error: { code, message, details? } }. */
export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

/** "sections[0].groups[2].questions[1]" from a Zod issue path. */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === 'number') return `${acc}[${seg}]`;
    const key = String(seg);
    return acc === '' ? key : `${acc}.${key}`;
  }, '');
}

export function zodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({ path: formatIssuePath(i.path), code: i.code, message: i.message }));
}
