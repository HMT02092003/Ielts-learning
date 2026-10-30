import { rateLimit } from 'express-rate-limit';
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
