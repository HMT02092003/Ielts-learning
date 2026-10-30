import { Router, type Request } from 'express';
import type { z } from 'zod';
import { AppError } from '../../lib/errors';
import { authenticate } from '../../middlewares/authenticate';
import { validate, validated } from '../../middlewares/validate';
import { IdParams } from '../../shared/admin';
import {
  BandTrendQuery,
  CreateVocabularyBody,
  DictionaryQuery,
  HeatmapQuery,
  ListVocabularyQuery,
  ReviewBody,
  TestMarkBody,
  TestMarkParams,
  UpdateVocabularyBody,
} from '../../shared/study';
import { dictionaryService } from '../dictionary/dictionary.service';
import { vocabularyService } from '../vocabulary/vocabulary.service';
import { statsService } from './stats.service';

const actor = (req: Request) => {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user;
};
const id = (res: Parameters<typeof validated>[0]) => validated<{ id: string }>(res, 'params').id;

/** /stats/* — the signed-in student's own statistics. */
export const statsRouter = Router();
statsRouter.use(authenticate);
statsRouter.get('/dashboard', validate({}), async (req, res) => {
  res.json(await statsService.dashboard(actor(req)));
});
statsRouter.get('/band-trend', validate({ query: BandTrendQuery }), async (req, res) => {
  res.json(
    await statsService.bandTrend(actor(req).id, validated<z.infer<typeof BandTrendQuery>>(res, 'query')),
  );
});
statsRouter.get('/heatmap', validate({ query: HeatmapQuery }), async (req, res) => {
  res.json(await statsService.heatmap(actor(req).id, validated<{ days: number }>(res, 'query').days));
});
statsRouter.get('/radar', validate({}), async (req, res) => {
  res.json(await statsService.radar(actor(req).id));
});

/** /me/tests/:seriesKey/mark — "đánh dấu đã làm" / hide from suggestions. */
export const meRouter = Router();
meRouter.use(authenticate);
meRouter.put(
  '/tests/:seriesKey/mark',
  validate({ params: TestMarkParams, body: TestMarkBody }),
  async (req, res) => {
    res.json(
      await statsService.setMark(
        actor(req).id,
        validated<{ seriesKey: string }>(res, 'params').seriesKey,
        validated<z.infer<typeof TestMarkBody>>(res, 'body'),
      ),
    );
  },
);

/** /vocabulary — notebook + flashcards. */
export const vocabularyRouter = Router();
vocabularyRouter.use(authenticate);
vocabularyRouter.get('/', validate({ query: ListVocabularyQuery }), async (req, res) => {
  res.json(
    await vocabularyService.list(actor(req).id, validated<z.infer<typeof ListVocabularyQuery>>(res, 'query')),
  );
});
vocabularyRouter.get(
  '/review-queue',
  validate({ query: ListVocabularyQuery.pick({ pageSize: true }) }),
  async (req, res) => {
    res.json(
      await vocabularyService.queue(actor(req).id, validated<{ pageSize: number }>(res, 'query').pageSize),
    );
  },
);
vocabularyRouter.post('/', validate({ body: CreateVocabularyBody }), async (req, res) => {
  res
    .status(201)
    .json(
      await vocabularyService.create(
        actor(req).id,
        validated<z.infer<typeof CreateVocabularyBody>>(res, 'body'),
      ),
    );
});
vocabularyRouter.patch(
  '/:id',
  validate({ params: IdParams, body: UpdateVocabularyBody }),
  async (req, res) => {
    res.json(
      await vocabularyService.update(
        actor(req).id,
        id(res),
        validated<z.infer<typeof UpdateVocabularyBody>>(res, 'body'),
      ),
    );
  },
);
vocabularyRouter.delete('/:id', validate({ params: IdParams }), async (req, res) => {
  await vocabularyService.remove(actor(req).id, id(res));
  res.status(204).end();
});
vocabularyRouter.post('/:id/review', validate({ params: IdParams, body: ReviewBody }), async (req, res) => {
  const b = validated<z.infer<typeof ReviewBody>>(res, 'body');
  res.json(await vocabularyService.review(actor(req).id, id(res), b.grade, b.clientReviewId));
});

/** /dictionary/lookup?term= */
export const dictionaryRouter = Router();
dictionaryRouter.use(authenticate);
dictionaryRouter.get('/lookup', validate({ query: DictionaryQuery }), async (_req, res) => {
  res.json(await dictionaryService.lookup(validated<{ term: string }>(res, 'query').term));
});
