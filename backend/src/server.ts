import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { terminateTesseract } from './lib/ocr/tesseract';
import { ocrService } from './modules/ocr/ocr.service';
import { ocrWorker } from './modules/ocr/ocr.worker';
import { PollingWorker } from './lib/jobs/polling-worker';
import { attemptsService } from './modules/attempts/attempts.service';

/** Auto-submits attempts past their server deadline + grace (also done lazily on every read/write). */
const attemptSweeper = new PollingWorker({
  name: 'attempt-sweeper',
  intervalMs: env.ATTEMPT_SWEEP_INTERVAL_MS,
  tick: () => attemptsService.finalizeExpired(),
});

const app = createApp();
const server = app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(`API listening on http://${env.API_HOST}:${env.API_PORT}/api/v1`);
});

const workers = [
  { worker: ocrWorker, enabled: env.OCR_WORKER_ENABLED, boot: () => ocrService.resetInterrupted() },
  { worker: attemptSweeper, enabled: true, boot: () => Promise.resolve() },
];
for (const w of workers) {
  if (!w.enabled) continue;
  void w
    .boot()
    .then(() => {
      w.worker.start();
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'worker boot failed');
    });
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  server.close();
  await Promise.all(workers.map((w) => w.worker.stop()));
  await terminateTesseract();
  await prisma.$disconnect();
  process.exit(0);
}

// Windows does not deliver SIGTERM; Ctrl+C sends SIGINT.
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
