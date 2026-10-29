import { ERROR_CATALOG, type ErrorCode } from '../shared/errors';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_CATALOG[code];
    this.details = details;
  }
}

export const notFound = (what = 'Tài nguyên') => new AppError('NOT_FOUND', `${what} không tồn tại`);
