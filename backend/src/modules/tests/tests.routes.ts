import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { authenticate, requireRole } from '../../middlewares/authenticate';
import { upload } from '../../middlewares/upload';
import { validate } from '../../middlewares/validate';
import {
  AdminListTestsQuery,
  HotfixQuestionBody,
  IdParams,
  ReplaceTestContentBody,
  UpdateTestMetaBody,
} from '../../shared/admin';
import { Uuid } from '../../shared/primitives';
import * as tests from './tests.controller';

const importUpload = upload({ field: 'files', maxFiles: 60, maxBytes: env.UPLOAD_MAX_AUDIO_MB * 1_048_576 });
const Empty = z.unknown();

/** Mounted at /admin/tests. */
export const adminTestsRouter = Router();

adminTestsRouter.use(authenticate, requireRole('ADMIN'));
adminTestsRouter.get('/', validate({ query: AdminListTestsQuery }), tests.list);
adminTestsRouter.post('/import/validate', importUpload, validate({ body: Empty }), tests.validateImport);
adminTestsRouter.post('/import', importUpload, validate({ body: Empty }), tests.importNew);
adminTestsRouter.get('/:id', validate({ params: IdParams }), tests.get);
adminTestsRouter.get('/:id/export.zip', validate({ params: IdParams }), tests.exportZip);
adminTestsRouter.get('/:id/questions', validate({ params: IdParams }), tests.questions);
adminTestsRouter.put(
  '/:id/content',
  validate({ params: IdParams, body: ReplaceTestContentBody }),
  tests.replaceContent,
);
adminTestsRouter.patch('/:id', validate({ params: IdParams, body: UpdateTestMetaBody }), tests.updateMeta);
adminTestsRouter.post('/:id/publish', validate({ params: IdParams, body: Empty }), tests.publish);
adminTestsRouter.post('/:id/unpublish', validate({ params: IdParams, body: Empty }), tests.unpublish);
adminTestsRouter.post('/:id/clone', validate({ params: IdParams, body: Empty }), tests.clone);
adminTestsRouter.delete('/:id', validate({ params: IdParams }), tests.remove);
adminTestsRouter.patch(
  '/:id/questions/:questionId',
  validate({ params: z.strictObject({ id: Uuid, questionId: Uuid }), body: HotfixQuestionBody }),
  tests.hotfix,
);
