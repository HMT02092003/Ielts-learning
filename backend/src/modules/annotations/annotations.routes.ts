import { Router, type Request } from 'express';
import type { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { validate, validated } from '../../middlewares/validate';
import { AppError } from '../../lib/errors';
import { IdParams } from '../../shared/admin';
import { CreateAnnotationBody, UpdateAnnotationBody } from '../../shared/attempt';
import { annotationsService } from './annotations.service';

const actor = (req: Request) => {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user;
};

/** /attempts/:id/annotations (list, create) and /annotations/:id (update, delete). */
export const attemptAnnotationsRouter = Router({ mergeParams: true });
attemptAnnotationsRouter.use(authenticate);
attemptAnnotationsRouter.get('/:id/annotations', validate({ params: IdParams }), async (req, res) => {
  res.json(await annotationsService.list(validated<{ id: string }>(res, 'params').id, actor(req)));
});
attemptAnnotationsRouter.post(
  '/:id/annotations',
  validate({ params: IdParams, body: CreateAnnotationBody }),
  async (req, res) => {
    res
      .status(201)
      .json(
        await annotationsService.create(
          validated<{ id: string }>(res, 'params').id,
          actor(req),
          validated<z.infer<typeof CreateAnnotationBody>>(res, 'body'),
        ),
      );
  },
);

export const annotationsRouter = Router();
annotationsRouter.use(authenticate);
annotationsRouter.patch(
  '/:id',
  validate({ params: IdParams, body: UpdateAnnotationBody }),
  async (req, res) => {
    res.json(
      await annotationsService.update(
        validated<{ id: string }>(res, 'params').id,
        actor(req),
        validated<z.infer<typeof UpdateAnnotationBody>>(res, 'body'),
      ),
    );
  },
);
annotationsRouter.delete('/:id', validate({ params: IdParams }), async (req, res) => {
  await annotationsService.remove(validated<{ id: string }>(res, 'params').id, actor(req));
  res.status(204).end();
});
