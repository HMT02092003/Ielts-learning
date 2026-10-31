import { Router, type Request } from 'express';
import type { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { validate, validated } from '../../middlewares/validate';
import { AppError } from '../../lib/errors';
import { IdParams } from '../../shared/admin';
import { ListTestsQuery } from '../../shared/attempt';
import { ListSetsQuery } from '../../shared/test-sets';
import { testSetsService } from '../tests/test-sets.service';
import { catalogService } from './catalog.service';

const actor = (req: Request) => {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user;
};

/** /tests — the student library (published tests only). */
export const catalogRouter = Router();
catalogRouter.use(authenticate);
catalogRouter.get('/', validate({ query: ListTestsQuery }), async (req, res) => {
  res.json(await catalogService.list(actor(req).id, validated<z.infer<typeof ListTestsQuery>>(res, 'query')));
});
catalogRouter.get('/sets', validate({ query: ListSetsQuery }), async (req, res) => {
  res.json(await testSetsService.listStudent(actor(req).id, validated<ListSetsQuery>(res, 'query')));
});
catalogRouter.get('/:id', validate({ params: IdParams }), async (req, res) => {
  const a = actor(req);
  res.json(await catalogService.get(a.id, validated<{ id: string }>(res, 'params').id, a.role === 'ADMIN'));
});
