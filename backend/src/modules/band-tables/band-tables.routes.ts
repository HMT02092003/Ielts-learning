import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middlewares/authenticate';
import { validate, validated } from '../../middlewares/validate';
import { AppError } from '../../lib/errors';
import type { BandTableKind } from '../../shared/enums';
import { BandTableKindParams, UpdateBandTableBody } from '../../shared/scoring';
import { bandTablesService } from './band-tables.service';

const actorId = (req: Request) => {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user.id;
};
type KindParams = { kind: BandTableKind };

/** /band-tables — read-only for every signed-in user (result screens show which table was used). */
export const bandTablesRouter = Router();
bandTablesRouter.get('/', authenticate, validate({}), async (_req, res) => {
  res.json(await bandTablesService.listActive());
});

/** /admin/band-tables — edit (each save = new version) and reset to the reference table. */
export const adminBandTablesRouter = Router();
adminBandTablesRouter.use(authenticate, requireRole('ADMIN'));
adminBandTablesRouter.get('/:kind/history', validate({ params: BandTableKindParams }), async (_req, res) => {
  res.json(await bandTablesService.history(validated<KindParams>(res, 'params').kind));
});
adminBandTablesRouter.put(
  '/:kind',
  validate({ params: BandTableKindParams, body: UpdateBandTableBody }),
  async (req, res) => {
    res.json(
      await bandTablesService.update(
        validated<KindParams>(res, 'params').kind,
        validated<z.infer<typeof UpdateBandTableBody>>(res, 'body'),
        actorId(req),
      ),
    );
  },
);
adminBandTablesRouter.post(
  '/:kind/reset',
  validate({ params: BandTableKindParams, body: z.unknown() }),
  async (req, res) => {
    res.json(await bandTablesService.reset(validated<KindParams>(res, 'params').kind, actorId(req)));
  },
);
