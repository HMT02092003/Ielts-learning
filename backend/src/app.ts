import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { allowedWebOrigins, env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { originGuard } from './middlewares/origin-guard';
import { globalLimiter } from './middlewares/rate-limit';
import { adminRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { adminFilesRouter, filesRouter } from './modules/files/files.routes';
import { adminTestsRouter } from './modules/tests/tests.routes';
import { adminTestSetsRouter } from './modules/tests/test-sets.routes';
import { ocrRouter } from './modules/ocr/ocr.routes';
import { adminBandTablesRouter, bandTablesRouter } from './modules/band-tables/band-tables.routes';
import { annotationsRouter, attemptAnnotationsRouter } from './modules/annotations/annotations.routes';
import { attemptsRouter, timeRouter } from './modules/attempts/attempts.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { healthRouter } from './modules/health/health.routes';
import {
  adminGradingRouter,
  attemptWritingRouter,
  speakingRecordingsRouter,
  writingSubmissionsRouter,
} from './modules/writing/writing.routes';
import { attemptsService } from './modules/attempts/attempts.service';
import { catalogService } from './modules/catalog/catalog.service';
import { dictionaryRouter, meRouter, statsRouter, vocabularyRouter } from './modules/stats/stats.routes';
import { statsService } from './modules/stats/stats.service';

export function createApp() {
  const app = express();

  // Cross-module hooks (set here to avoid import cycles): study stats after every submit, manual "đã làm" marks.
  attemptsService.setOnFinalized((userId, at) => statsService.onActivity(userId, at));
  catalogService.setMarkedDone((userId, keys) => statsService.markedDone(userId, keys));

  app.disable('x-powered-by');
  // Browsers reach the API through the Next.js rewrite on the same machine; trust only loopback proxies.
  app.set('trust proxy', 'loopback');

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      // Docker healthchecks hit /health every 10 s — keep them out of the logs.
      autoLogging: { ignore: (req) => req.url.startsWith('/api/v1/health') },
    }),
  );
  app.use(helmet());
  // Same-origin via the Next.js rewrite is the normal path; CORS only allowlists the web origin.
  app.use(cors({ origin: [...allowedWebOrigins], credentials: true }));
  // Test documents (JSON editor) can be a few MB; everything else is small.
  app.use(express.json({ limit: `${env.IMPORT_MAX_JSON_MB}mb` }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(globalLimiter);
  api.use(originGuard);
  api.use('/health', healthRouter);
  api.use('/auth', authRouter);
  api.use('/admin/users', usersRouter);
  api.use('/admin/files', adminFilesRouter);
  api.use('/admin/tests', adminTestsRouter);
  api.use('/admin/test-sets', adminTestSetsRouter);
  api.use('/admin/ocr-jobs', ocrRouter);
  api.use('/admin/band-tables', adminBandTablesRouter);
  api.use('/band-tables', bandTablesRouter);
  api.use('/time', timeRouter);
  api.use('/tests', catalogRouter);
  api.use('/attempts', attemptAnnotationsRouter);
  api.use('/attempts', attemptWritingRouter);
  api.use('/attempts', attemptsRouter);
  api.use('/writing-submissions', writingSubmissionsRouter);
  api.use('/speaking-recordings', speakingRecordingsRouter);
  api.use('/admin/grading', adminGradingRouter);
  api.use('/stats', statsRouter);
  api.use('/me', meRouter);
  api.use('/vocabulary', vocabularyRouter);
  api.use('/dictionary', dictionaryRouter);
  api.use('/annotations', annotationsRouter);
  api.use('/files', filesRouter);
  api.use('/admin', adminRouter);

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
