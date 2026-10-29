import type { RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { zodIssues } from '../shared/errors';
import { AppError } from '../lib/errors';

interface Schemas<P extends z.ZodType, Q extends z.ZodType, B extends z.ZodType> {
  params?: P;
  query?: Q;
  body?: B;
}

/**
 * Every route goes through validate() (spec §2). Parsed values are stored in res.locals.validated
 * (Express 5 `req.query` is a read-only getter); read them with `validated(res)`.
 */
export function validate<
  P extends z.ZodType = z.ZodUndefined,
  Q extends z.ZodType = z.ZodUndefined,
  B extends z.ZodType = z.ZodUndefined,
>(schemas: Schemas<P, Q, B>): RequestHandler {
  return (req, res, next) => {
    const out: { params?: unknown; query?: unknown; body?: unknown } = {};
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(key === 'body' ? (req.body ?? {}) : req[key]);
      if (!result.success) {
        const issues = zodIssues(result.error).map((i) => ({
          ...i,
          path: i.path ? `${key}.${i.path}` : key,
        }));
        next(new AppError('VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ', { issues }));
        return;
      }
      out[key] = result.data;
    }
    res.locals.validated = out;
    next();
  };
}

/** Typed accessor for values parsed by validate(). */
// The type parameter is the caller's declaration of what validate() produced for this route.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function validated<T>(res: Response, key: 'params' | 'query' | 'body'): T {
  return res.locals.validated?.[key] as T;
}
