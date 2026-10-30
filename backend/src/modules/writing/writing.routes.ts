import { Router, type Request } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { authenticate, requireRole } from '../../middlewares/authenticate';
import { upload, uploadedFiles } from '../../middlewares/upload';
import { validate, validated } from '../../middlewares/validate';
import { IdParams, PageQuery } from '../../shared/admin';
import { Uuid } from '../../shared/primitives';
import {
  ChecklistBody,
  GradingQueueQuery,
  HumanSpeakingReviewBody,
  HumanWritingReviewBody,
  RecordingUploadFields,
  WritingPartParams,
  WritingSaveBody,
} from '../../shared/writing';
import { gradingService } from '../grading/grading.service';
import { speakingService } from '../speaking/speaking.service';
import { writingService } from './writing.service';

const MB = 1_048_576;

const actor = (req: Request) => {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập');
  return req.user;
};
const id = (res: Parameters<typeof validated>[0]) => validated<{ id: string }>(res, 'params').id;

/** /attempts/:id/writing… and /attempts/:id/speaking… */
export const attemptWritingRouter = Router();
attemptWritingRouter.use(authenticate);
attemptWritingRouter.get('/:id/writing', validate({ params: IdParams }), async (req, res) => {
  res.json(await writingService.list(id(res), actor(req)));
});
attemptWritingRouter.put(
  '/:id/writing/:partId',
  validate({ params: WritingPartParams, body: WritingSaveBody }),
  async (req, res) => {
    const p = validated<z.infer<typeof WritingPartParams>>(res, 'params');
    res.json(
      await writingService.save(
        p.id,
        p.partId,
        actor(req),
        validated<z.infer<typeof WritingSaveBody>>(res, 'body'),
      ),
    );
  },
);
attemptWritingRouter.get('/:id/speaking', validate({ params: IdParams }), async (req, res) => {
  res.json(await speakingService.get(id(res), actor(req)));
});
attemptWritingRouter.post(
  '/:id/speaking/recordings',
  upload({ field: 'audio', maxFiles: 1, maxBytes: env.UPLOAD_MAX_RECORDING_MB * MB }),
  validate({ params: IdParams, body: RecordingUploadFields }),
  async (req, res) => {
    const file = uploadedFiles(req)[0];
    if (!file) throw new AppError('VALIDATION_ERROR', 'Thiếu file ghi âm');
    res
      .status(201)
      .json(
        await speakingService.upload(
          id(res),
          actor(req),
          file,
          validated<z.infer<typeof RecordingUploadFields>>(res, 'body'),
        ),
      );
  },
);

/** /writing-submissions — the student's essays (history, compare, checklist, re-run the estimate). */
export const writingSubmissionsRouter = Router();
writingSubmissionsRouter.use(authenticate);
writingSubmissionsRouter.get(
  '/',
  validate({ query: PageQuery.extend({ partId: Uuid.optional() }) }),
  async (req, res) => {
    res.json(
      await writingService.listMine(
        actor(req),
        validated<{ partId?: string; page: number; pageSize: number }>(res, 'query'),
      ),
    );
  },
);
writingSubmissionsRouter.get('/:id', validate({ params: IdParams }), async (req, res) => {
  res.json(await writingService.get(id(res), actor(req)));
});
writingSubmissionsRouter.put(
  '/:id/checklist',
  validate({ params: IdParams, body: ChecklistBody }),
  async (req, res) => {
    res.json(
      await writingService.setChecklist(
        id(res),
        actor(req),
        validated<z.infer<typeof ChecklistBody>>(res, 'body').checklist,
      ),
    );
  },
);
writingSubmissionsRouter.post(
  '/:id/evaluate',
  validate({ params: IdParams, body: z.unknown() }),
  async (req, res) => {
    res.json(await writingService.reevaluate(id(res), actor(req)));
  },
);

/** /speaking-recordings/:id — delete a take while the attempt is open. */
export const speakingRecordingsRouter = Router();
speakingRecordingsRouter.use(authenticate);
speakingRecordingsRouter.delete('/:id', validate({ params: IdParams }), async (req, res) => {
  await speakingService.removeRecording(id(res), actor(req));
  res.status(204).end();
});

/** /admin/grading… — queue and human reviews. */
export const adminGradingRouter = Router();
adminGradingRouter.use(authenticate, requireRole('ADMIN'));
adminGradingRouter.get('/', validate({ query: GradingQueueQuery }), async (_req, res) => {
  res.json(await gradingService.queue(validated<z.infer<typeof GradingQueueQuery>>(res, 'query')));
});
adminGradingRouter.post(
  '/writing/:id/reviews',
  validate({ params: IdParams, body: HumanWritingReviewBody }),
  async (req, res) => {
    res
      .status(201)
      .json(
        await writingService.review(
          id(res),
          actor(req),
          validated<z.infer<typeof HumanWritingReviewBody>>(res, 'body'),
        ),
      );
  },
);
adminGradingRouter.post(
  '/speaking/:id/reviews',
  validate({ params: IdParams, body: HumanSpeakingReviewBody }),
  async (req, res) => {
    res
      .status(201)
      .json(
        await speakingService.review(
          id(res),
          actor(req),
          validated<z.infer<typeof HumanSpeakingReviewBody>>(res, 'body'),
        ),
      );
  },
);
