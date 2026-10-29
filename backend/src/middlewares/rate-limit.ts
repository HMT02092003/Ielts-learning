import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

const onLimit = () => new AppError('RATE_LIMITED', 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút');

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_GLOBAL_PER_MIN,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(onLimit());
  },
});

/** Login: per IP + email, so one person cannot lock out another and brute force stays slow. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.RATE_LIMIT_LOGIN_PER_15MIN,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const body: unknown = req.body;
    const email =
      typeof body === 'object' && body !== null && 'email' in body && typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';
    return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
  },
  handler: (_req, _res, next) => {
    next(onLimit());
  },
});
