import { PollingWorker } from '../../lib/jobs/polling-worker';
import { ocrService } from './ocr.service';

/** Background OCR queue (one job at a time). Started from server.ts when OCR_WORKER_ENABLED=true. */
export const ocrWorker = new PollingWorker({
  name: 'ocr',
  intervalMs: 5_000,
  tick: (signal) => ocrService.processNext(signal),
});
