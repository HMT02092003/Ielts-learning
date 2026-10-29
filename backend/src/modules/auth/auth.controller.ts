import type { Request, RequestHandler, Response } from 'express';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '../../lib/cookies';
import { AppError } from '../../lib/errors';
import type { AuthResponse, ChangePasswordBody, LoginBody, UpdateMeBody } from '../../shared/auth';
import { validated } from '../../middlewares/validate';
import { authService, type IssuedSession } from './auth.service';

const refreshCookie = (req: Request) => (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];

function currentUserId(req: Request): string {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user.id;
}

function sendSession(res: Response, s: IssuedSession): void {
  setSessionCookies(res, {
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    maxAgeMs: s.cookieMaxAgeMs,
  });
  const body: AuthResponse = { user: s.user, accessExpiresAt: s.accessExpiresAt.toISOString() };
  res.json(body);
}

export const login: RequestHandler = async (req, res) => {
  const session = await authService.login(validated<LoginBody>(res, 'body'));
  req.log.info({ userId: session.user.id }, 'login succeeded');
  sendSession(res, session);
};

export const refresh: RequestHandler = async (req, res) => {
  try {
    sendSession(res, await authService.refresh(refreshCookie(req)));
  } catch (err) {
    clearSessionCookies(res);
    throw err;
  }
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(refreshCookie(req));
  clearSessionCookies(res);
  res.status(204).end();
};

export const logoutAll: RequestHandler = async (req, res) => {
  await authService.logoutAll(currentUserId(req));
  clearSessionCookies(res);
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  res.json(await authService.me(currentUserId(req)));
};

export const updateMe: RequestHandler = async (req, res) => {
  res.json(await authService.updateMe(currentUserId(req), validated<UpdateMeBody>(res, 'body')));
};

export const changePassword: RequestHandler = async (req, res) => {
  await authService.changePassword(
    currentUserId(req),
    validated<ChangePasswordBody>(res, 'body'),
    refreshCookie(req),
  );
  res.status(204).end();
};
