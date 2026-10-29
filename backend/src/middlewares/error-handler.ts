import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ErrorBody } from '../shared/errors';
import { AppError } from '../lib/errors';

/** Body-parser errors carry `type` and `status`. */
function isHttpParserError(err: unknown): err is { type: string; status: number } {
  return typeof err === 'object' && err !== null && 'type' in err && 'status' in err;
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (isHttpParserError(err)) {
    if (err.type === 'entity.too.large') return new AppError('FILE_TOO_LARGE', 'Nội dung gửi lên quá lớn');
    if (err.type === 'entity.parse.failed') return new AppError('VALIDATION_ERROR', 'JSON không hợp lệ');
    if (err.status === 415) return new AppError('UNSUPPORTED_MEDIA_TYPE', 'Kiểu nội dung không được hỗ trợ');
  }
  return new AppError('INTERNAL', 'Đã có lỗi xảy ra, vui lòng thử lại');
}

/** Central error handler → { error: { code, message, details? } } (spec §2). */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const appErr = toAppError(err);
  if (appErr.status >= 500) req.log.error({ err }, 'unhandled error');
  else req.log.info({ code: appErr.code }, 'request rejected');

  const body: ErrorBody = { error: { code: appErr.code, message: appErr.message } };
  if (appErr.details !== undefined) body.error.details = appErr.details;
  res.status(appErr.status).json(body);
};

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND', 'Không tìm thấy đường dẫn'));
};
