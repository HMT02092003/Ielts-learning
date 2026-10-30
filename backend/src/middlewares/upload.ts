import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { env, resolveFromBackend } from '../config/env';
import { AppError } from '../lib/errors';

const TMP_DIR = resolveFromBackend(env.UPLOAD_TMP_DIR);

/**
 * multipart upload → temp files in data/tmp (random names, never the client name). Size and count are capped
 * here; the real type check (magic bytes) happens in files.service. Temp files are removed when the response ends.
 */
export function upload(opts: { field: string; maxFiles: number; maxBytes: number }): RequestHandler {
  const handler = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(TMP_DIR, { recursive: true });
        cb(null, TMP_DIR);
      },
      filename: (_req, _file, cb) => {
        cb(null, `${randomUUID()}.upload`);
      },
    }),
    limits: {
      fileSize: opts.maxBytes,
      files: opts.maxFiles,
      fields: 10,
      fieldSize: 10_000,
      parts: opts.maxFiles + 10,
    },
  }).array(opts.field, opts.maxFiles);

  return (req, res, next) => {
    res.on('close', () => {
      const files = Array.isArray(req.files) ? req.files : [];
      for (const f of files) fs.rm(f.path, { force: true }, () => undefined);
    });
    handler(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          next(new AppError('FILE_TOO_LARGE', `File vượt quá ${Math.round(opts.maxBytes / 1_048_576)} MB`));
          return;
        }
        next(new AppError('VALIDATION_ERROR', `Upload không hợp lệ (${err.code})`));
        return;
      }
      if (err) {
        next(err);
        return;
      }
      if (!Array.isArray(req.files) || req.files.length === 0) {
        next(new AppError('VALIDATION_ERROR', `Thiếu file (trường "${opts.field}")`));
        return;
      }
      next();
    });
  };
}

export function uploadedFiles(req: Parameters<RequestHandler>[0]): Express.Multer.File[] {
  return Array.isArray(req.files) ? req.files : [];
}
