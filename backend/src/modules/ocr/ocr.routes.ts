import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { authenticate, requireRole } from '../../middlewares/authenticate';
import { upload } from '../../middlewares/upload';
import { validate } from '../../middlewares/validate';
import { IdParams, PageQuery } from '../../shared/admin';
import {
  AssembleMeta,
  CreateOcrJobBody,
  PublishOcrBody,
  RotatePageBody,
  SaveReviewBody,
} from '../../shared/ocr';
import { Uuid } from '../../shared/primitives';
import * as ocr from './ocr.controller';

const PageParams = z.strictObject({ id: Uuid, pageId: Uuid });

/** Mounted at /admin/ocr-jobs. */
export const ocrRouter = Router();

ocrRouter.use(authenticate, requireRole('ADMIN'));
ocrRouter.get('/', validate({ query: PageQuery }), ocr.list);
ocrRouter.post(
  '/',
  upload({ field: 'files', maxFiles: 30, maxBytes: env.UPLOAD_MAX_PDF_MB * 1_048_576 }),
  validate({ body: CreateOcrJobBody }),
  ocr.create,
);
ocrRouter.get('/:id', validate({ params: IdParams }), ocr.get);
ocrRouter.put('/:id/review', validate({ params: IdParams, body: SaveReviewBody }), ocr.saveReview);
ocrRouter.post(
  '/:id/pages/:pageId/rotate',
  validate({ params: PageParams, body: RotatePageBody }),
  ocr.rotatePage,
);
ocrRouter.post(
  '/:id/pages/:pageId/approve',
  validate({ params: PageParams, body: z.unknown() }),
  ocr.approvePage,
);
ocrRouter.post('/:id/assemble', validate({ params: IdParams, body: AssembleMeta }), ocr.assemble);
ocrRouter.post('/:id/publish', validate({ params: IdParams, body: PublishOcrBody }), ocr.publish);
ocrRouter.post('/:id/retry', validate({ params: IdParams, body: z.unknown() }), ocr.retry);
ocrRouter.delete('/:id', validate({ params: IdParams }), ocr.remove);
