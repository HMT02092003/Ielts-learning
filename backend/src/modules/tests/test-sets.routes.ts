import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/authenticate';
import { validate, validated } from '../../middlewares/validate';
import { ListSetsQuery } from '../../shared/test-sets';
import { testSetsService } from './test-sets.service';

/** Mounted at /admin/test-sets. */
export const adminTestSetsRouter = Router();

adminTestSetsRouter.use(authenticate, requireRole('ADMIN'));
adminTestSetsRouter.get('/', validate({ query: ListSetsQuery }), async (_req, res) => {
  res.json(await testSetsService.listAdmin(validated<ListSetsQuery>(res, 'query')));
});
