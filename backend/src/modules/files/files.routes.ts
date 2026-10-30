import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { authenticate, requireRole } from '../../middlewares/authenticate';
import { upload } from '../../middlewares/upload';
import { validate } from '../../middlewares/validate';
import { IdParams, PageQuery, UploadFileBody } from '../../shared/admin';
import { FilePurpose } from '../../shared/enums';
import * as files from './files.controller';

const MB = 1_048_576;

/** /files/:id — any signed-in user, access decided per purpose in files.service. */
export const filesRouter = Router();
filesRouter.get('/:id', authenticate, validate({ params: IdParams }), files.serve);

/** /admin/files — test media library. */
export const adminFilesRouter = Router();
adminFilesRouter.use(authenticate, requireRole('ADMIN'));
adminFilesRouter.get(
  '/',
  validate({ query: PageQuery.extend({ purpose: FilePurpose.optional() }) }),
  files.list,
);
adminFilesRouter.post(
  '/',
  upload({ field: 'file', maxFiles: 1, maxBytes: env.UPLOAD_MAX_AUDIO_MB * MB }),
  validate({ body: UploadFileBody }),
  files.upload,
);
adminFilesRouter.delete('/:id', validate({ params: IdParams, body: z.unknown() }), files.remove);
