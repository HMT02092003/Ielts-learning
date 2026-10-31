import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { localDate } from '../../lib/tz';
import { authenticate, requireRole } from '../../middlewares/authenticate';
import { validate, validated } from '../../middlewares/validate';
import { ListSetsQuery, SetExportQuery, SetKeyParams } from '../../shared/test-sets';
import { testSetsService } from './test-sets.service';
import { zipExportService } from './zip-export.service';

/** Mounted at /admin/test-sets. */
export const adminTestSetsRouter = Router();

adminTestSetsRouter.use(authenticate, requireRole('ADMIN'));
adminTestSetsRouter.get('/', validate({ query: ListSetsQuery }), async (_req, res) => {
  res.json(await testSetsService.listAdmin(validated<ListSetsQuery>(res, 'query')));
});
adminTestSetsRouter.post(
  '/:setKey/publish',
  validate({ params: SetKeyParams, body: z.unknown() }),
  async (req, res) => {
    if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
    res.json(await testSetsService.publishSet(validated<SetKeyParams>(res, 'params').setKey, req.user.id));
  },
);
adminTestSetsRouter.get(
  '/:setKey/export.zip',
  validate({ params: SetKeyParams, query: SetExportQuery }),
  async (_req, res) => {
    const { setKey } = validated<SetKeyParams>(res, 'params');
    const { include } = validated<SetExportQuery>(res, 'query');
    const tests = await testSetsService.testsInSet(setKey, include);
    res.attachment(`BandUp-${setKey}-${localDate(new Date())}.zip`).type('application/zip');
    await zipExportService.streamZip(
      tests.map((t) => t.id),
      res,
    );
  },
);
