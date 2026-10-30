// Typed fetch wrapper for the backend (same-origin /api/v1 via the Next.js rewrite, httpOnly cookies).
// On AUTH_TOKEN_EXPIRED it refreshes once (single-flight across concurrent calls) and retries.
import type { z } from 'zod';
import { ErrorBody, type ErrorCode } from '@/shared/errors';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'CONTRACT_MISMATCH',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const SESSION_CODES = new Set(['UNAUTHENTICATED', 'AUTH_REFRESH_INVALID']);
export const isSessionError = (e: unknown) => e instanceof ApiError && SESSION_CODES.has(e.code);

/** Endpoints that must never trigger a refresh-and-retry (they ARE the session endpoints). */
const NO_REFRESH = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh: concurrent 401s share one POST /auth/refresh. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    credentials: 'same-origin',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON body, or FormData for multipart uploads (the browser sets the boundary header). */
  body?: unknown;
  /** Response schema — the response is parsed (fail-closed) when given. */
  schema?: S;
  signal?: AbortSignal;
}

async function toApiError(res: Response): Promise<ApiError> {
  const json: unknown = await res.json().catch(() => null);
  const parsed = ErrorBody.safeParse(json);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(res.status, code, message, details);
  }
  return new ApiError(res.status, 'INTERNAL', `Lỗi máy chủ (${res.status})`);
}

export async function api<S extends z.ZodType = z.ZodUnknown>(
  path: string,
  opts: RequestOptions<S> = {},
): Promise<z.infer<S>> {
  const doFetch = () =>
    fetch(`/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers:
        opts.body === undefined || opts.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' },
      body:
        opts.body === undefined
          ? undefined
          : opts.body instanceof FormData
            ? opts.body
            : JSON.stringify(opts.body),
      credentials: 'same-origin',
      signal: opts.signal,
    });

  let res: Response;
  try {
    res = await doFetch();
    if (res.status === 401 && !NO_REFRESH.has(path)) {
      const err = await toApiError(res.clone());
      if (err.code === 'AUTH_TOKEN_EXPIRED') {
        // Refresh failed → the API cleared the cookies: report a session error so the UI goes to /login.
        if (!(await refreshSession()))
          throw new ApiError(401, 'AUTH_REFRESH_INVALID', 'Phiên đăng nhập đã hết');
        res = await doFetch();
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ');
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as z.infer<S>;
  const json: unknown = await res.json();
  if (!opts.schema) return json as z.infer<S>;
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success)
    throw new ApiError(res.status, 'CONTRACT_MISMATCH', 'Dữ liệu trả về không đúng định dạng');
  return parsed.data;
}
