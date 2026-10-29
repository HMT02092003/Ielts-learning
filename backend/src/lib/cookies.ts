import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';

// Localhost-only for now (COOKIE_SECURE=false). With HTTPS, switch to the __Host-/__Secure- prefixed names.
export const ACCESS_COOKIE = env.COOKIE_SECURE ? '__Host-ielts_at' : 'ielts_at';
export const REFRESH_COOKIE = env.COOKIE_SECURE ? '__Secure-ielts_rt' : 'ielts_rt';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

interface SessionCookies {
  accessToken: string;
  refreshToken: string;
  /** Remaining lifetime of the refresh token; undefined → session cookies ("Ghi nhớ" not ticked). */
  maxAgeMs: number | undefined;
}

const base = (): CookieOptions => ({ httpOnly: true, secure: env.COOKIE_SECURE });

/**
 * Access cookie lives as long as the refresh token (the JWT inside still expires after 15 min), so the
 * web proxy keeps the user "logged in" and the client refreshes transparently on AUTH_TOKEN_EXPIRED.
 */
export function setSessionCookies(res: Response, c: SessionCookies): void {
  const maxAge = c.maxAgeMs === undefined ? {} : { maxAge: c.maxAgeMs };
  res.cookie(ACCESS_COOKIE, c.accessToken, { ...base(), sameSite: 'lax', path: '/', ...maxAge });
  res.cookie(REFRESH_COOKIE, c.refreshToken, {
    ...base(),
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    ...maxAge,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(), sameSite: 'lax', path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(), sameSite: 'strict', path: REFRESH_COOKIE_PATH });
}
