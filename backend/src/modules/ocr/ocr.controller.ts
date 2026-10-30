import type { Request, RequestHandler } from 'express';
import { uploadedFiles } from '../../middlewares/upload';
import { validated } from '../../middlewares/validate';
import { AppError } from '../../lib/errors';
import type { IdParams, PageQuery } from '../../shared/admin';
import type { AssembleMeta, SaveReviewBody } from '../../shared/ocr';
import { ocrWorker } from './ocr.worker';
import { ocrService } from './ocr.service';

const actorId = (req: Request) => {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user.id;
};

type PageParams = { id: string; pageId: string };

export const create: RequestHandler = async (req, res) => {
  const { title } = validated<{ title?: string }>(res, 'body');
  const job = await ocrService.create(uploadedFiles(req), title, actorId(req));
  ocrWorker.nudge();
  res.status(202).json(job);
};

export const list: RequestHandler = async (_req, res) => {
  res.json(await ocrService.list(validated<PageQuery>(res, 'query')));
};

export const get: RequestHandler = async (_req, res) => {
  res.json(await ocrService.get(validated<IdParams>(res, 'params').id));
};

export const saveReview: RequestHandler = async (_req, res) => {
  res.json(
    await ocrService.saveReview(
      validated<IdParams>(res, 'params').id,
      validated<SaveReviewBody>(res, 'body'),
    ),
  );
};

export const rotatePage: RequestHandler = async (req, res) => {
  const { id, pageId } = validated<PageParams>(res, 'params');
  const { rotation } = validated<{ rotation: number }>(res, 'body');
  res.json(await ocrService.rotatePage(id, pageId, rotation, actorId(req)));
};

export const approvePage: RequestHandler = async (_req, res) => {
  const { id, pageId } = validated<PageParams>(res, 'params');
  await ocrService.approvePage(id, pageId);
  res.status(204).end();
};

export const assemble: RequestHandler = async (_req, res) => {
  res.json(
    await ocrService.assemble(validated<IdParams>(res, 'params').id, validated<AssembleMeta>(res, 'body')),
  );
};

export const publish: RequestHandler = async (req, res) => {
  const { publishNow } = validated<{ publishNow: boolean }>(res, 'body');
  res
    .status(201)
    .json(await ocrService.publish(validated<IdParams>(res, 'params').id, publishNow, actorId(req)));
};

export const retry: RequestHandler = async (_req, res) => {
  const job = await ocrService.retry(validated<IdParams>(res, 'params').id);
  ocrWorker.nudge();
  res.status(202).json(job);
};

export const remove: RequestHandler = async (_req, res) => {
  await ocrService.remove(validated<IdParams>(res, 'params').id);
  res.status(204).end();
};
