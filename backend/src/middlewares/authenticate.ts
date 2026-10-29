import type { RequestHandler } from 'express';
import { ACCESS_COOKIE } from '../lib/cookies';
import { AppError } from '../lib/errors';
import type { Role } from '../shared/enums';
import { authService } from '../modules/auth/auth.service';
import { verifyAccessToken } from '../modules/auth/token.service';

/** Requires a valid access JWT (httpOnly cookie) for an active user; sets req.user. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const cookies = req.cookies as Record<string, string | undefined>;
  const token = cookies[ACCESS_COOKIE];
  if (!token) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  const claims = verifyAccessToken(token);
  const user = await authService.getActiveUser(claims.sub);
  if (!user) throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ');
  req.user = user;
  next();
};

/** Must run after `authenticate`. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      // 404 instead of 403 for admin-only resources: do not reveal they exist.
      throw new AppError('NOT_FOUND', 'Không tìm thấy đường dẫn');
    }
    next();
  };
