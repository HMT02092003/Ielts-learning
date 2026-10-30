import { pipeline } from 'node:stream/promises';
import type { Request, RequestHandler } from 'express';
import { env } from '../../config/env';
import { uploadedFiles } from '../../middlewares/upload';
import { validated } from '../../middlewares/validate';
import { AppError } from '../../lib/errors';
import type { IdParams, UploadFileBody } from '../../shared/admin';
import type { FilePurpose } from '../../shared/enums';
import { filesService, toFileDto } from './files.service';

const actor = (req: Request) => {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user;
};

export const upload: RequestHandler = async (req, res) => {
  const { purpose } = validated<UploadFileBody>(res, 'body');
  const [file] = uploadedFiles(req);
  if (!file) throw new AppError('VALIDATION_ERROR', 'Thiếu file');
  if (purpose === 'TEST_IMAGE' && file.size > env.UPLOAD_MAX_IMAGE_MB * 1_048_576) {
    throw new AppError('FILE_TOO_LARGE', `Ảnh vượt quá ${env.UPLOAD_MAX_IMAGE_MB} MB`);
  }
  const stored = await filesService.ingest({
    path: file.path,
    purpose,
    originalName: file.originalname,
    uploadedById: actor(req).id,
  });
  res.status(201).json(toFileDto(stored));
};

export const list: RequestHandler = async (_req, res) => {
  res.json(
    await filesService.list(
      validated<{ purpose?: FilePurpose; page: number; pageSize: number }>(res, 'query'),
    ),
  );
};

export const remove: RequestHandler = async (_req, res) => {
  await filesService.remove(validated<IdParams>(res, 'params').id);
  res.status(204).end();
};

/** Streams a file with single-range support (206/416) so audio can be preloaded and seeked. */
export const serve: RequestHandler = async (req, res) => {
  const f = await filesService.findReadable(validated<IdParams>(res, 'params').id, actor(req));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', f.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Content-Disposition', `inline; filename="${f.id}"`);
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");

  const ranges = req.headers.range ? req.range(f.sizeBytes, { combine: true }) : undefined;
  if (ranges === -1) {
    res.status(416).setHeader('Content-Range', `bytes */${f.sizeBytes}`).end();
    return;
  }
  if (Array.isArray(ranges) && ranges.length === 1 && ranges[0]) {
    const { start, end } = ranges[0];
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${f.sizeBytes}`);
    res.setHeader('Content-Length', String(end - start + 1));
    await pipeline(await filesService.open(f, { start, end }), res);
    return;
  }
  res.setHeader('Content-Length', String(f.sizeBytes));
  await pipeline(await filesService.open(f), res);
};
