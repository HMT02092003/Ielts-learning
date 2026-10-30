import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { validate, validated } from '../../middlewares/validate';
import { AppError } from '../../lib/errors';
import { IdParams } from '../../shared/admin';
import { AutosaveBody, StartAttemptBody, SubmitBody } from '../../shared/attempt';
import { AttemptStatus, Skill } from '../../shared/enums';
import { attemptsService } from './attempts.service';

const actor = (req: Request) => {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user;
};
const idOf = (res: Parameters<typeof validated>[0]) => validated<{ id: string }>(res, 'params').id;

const ListAttemptsQuery = z.object({
  status: AttemptStatus.optional(),
  skill: Skill.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Mounted at /attempts. Only the owner writes; admins may read (404 for everyone else). */
export const attemptsRouter = Router();
attemptsRouter.use(authenticate);

attemptsRouter.post('/', validate({ body: StartAttemptBody }), async (req, res) => {
  const r = await attemptsService.start(actor(req), validated<z.infer<typeof StartAttemptBody>>(res, 'body'));
  res.status(r.resumed ? 200 : 201).json(r);
});
attemptsRouter.get('/', validate({ query: ListAttemptsQuery }), async (req, res) => {
  res.json(
    await attemptsService.list(actor(req), validated<z.infer<typeof ListAttemptsQuery>>(res, 'query')),
  );
});
attemptsRouter.get('/:id', validate({ params: IdParams }), async (req, res) => {
  res.json(await attemptsService.state(actor(req), idOf(res)));
});
attemptsRouter.get('/:id/content', validate({ params: IdParams }), async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(await attemptsService.content(actor(req), idOf(res)));
});
attemptsRouter.post('/:id/begin', validate({ params: IdParams, body: z.unknown() }), async (req, res) => {
  res.json(await attemptsService.begin(actor(req), idOf(res)));
});
attemptsRouter.post('/:id/autosave', validate({ params: IdParams, body: AutosaveBody }), async (req, res) => {
  res.json(
    await attemptsService.autosave(
      actor(req),
      idOf(res),
      validated<z.infer<typeof AutosaveBody>>(res, 'body'),
    ),
  );
});
attemptsRouter.post('/:id/submit', validate({ params: IdParams, body: SubmitBody }), async (req, res) => {
  res.json(
    await attemptsService.submit(actor(req), idOf(res), validated<z.infer<typeof SubmitBody>>(res, 'body')),
  );
});
attemptsRouter.delete('/:id', validate({ params: IdParams }), async (req, res) => {
  await attemptsService.abandon(actor(req), idOf(res));
  res.status(204).end();
});
attemptsRouter.get('/:id/result', validate({ params: IdParams }), async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(await attemptsService.result(actor(req), idOf(res)));
});
attemptsRouter.post(
  '/:id/retry-wrong',
  validate({ params: IdParams, body: z.unknown() }),
  async (req, res) => {
    res.status(201).json(await attemptsService.retryWrong(actor(req), idOf(res)));
  },
);

/** GET /time — server clock for the exam timer (client computes its offset from the round trip). */
export const timeRouter = Router();
timeRouter.get('/', validate({}), (_req, res) => {
  const now = new Date();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ serverNow: now.toISOString(), epochMs: now.getTime() });
});
