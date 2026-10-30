import { createRequire } from 'node:module';
import path from 'node:path';
import { createWorker, type Worker } from 'tesseract.js';
import { env, resolveFromBackend } from '../../config/env';
import type { OcrBlock } from '../../shared/ocr';

const require = createRequire(import.meta.url);
// Offline English traineddata shipped as an npm package (no CDN download at runtime).
const engData = require('@tesseract.js-data/eng') as { langPath: string; gzip: boolean };

/** Words below this confidence (0–100) are marked for review in the OCR screen. */
export const LOW_CONFIDENCE = 90;

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker('eng', 1, {
    langPath: engData.langPath,
    gzip: engData.gzip,
    cachePath: path.join(resolveFromBackend(env.UPLOAD_TMP_DIR), 'tesseract-cache'),
  });
  return workerPromise;
}

export async function terminateTesseract(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null);
  workerPromise = null;
  await w?.terminate();
}

interface TBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Recognise one page image → paragraph-level blocks with page-relative (0..1) boxes. */
export async function recognize(
  png: Buffer,
  size: { width: number; height: number },
): Promise<{ blocks: OcrBlock[]; meanConfidence: number }> {
  const worker = await getWorker();
  const { data } = await worker.recognize(png, {}, { blocks: true, text: true });
  const norm = (b: TBox) => ({
    x: b.x0 / size.width,
    y: b.y0 / size.height,
    w: (b.x1 - b.x0) / size.width,
    h: (b.y1 - b.y0) / size.height,
  });
  const blocks: OcrBlock[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      const text = para.lines
        .map((l) => l.words.map((w) => w.text).join(' '))
        .join('\n')
        .trim();
      if (!text) continue;
      // Offsets of low-confidence words inside `text` (search forward so repeated words map correctly).
      const lowConfidenceWords: OcrBlock['lowConfidenceWords'] = [];
      let cursor = 0;
      for (const line of para.lines) {
        for (const w of line.words) {
          const start = text.indexOf(w.text, cursor);
          if (start < 0) continue;
          cursor = start + w.text.length;
          if (w.confidence < LOW_CONFIDENCE) {
            lowConfidenceWords.push({ start, end: cursor, confidence: Math.round(w.confidence) });
          }
        }
      }
      blocks.push({
        id: `b${blocks.length + 1}`,
        bbox: norm(para.bbox),
        text,
        confidence: Math.round(para.confidence),
        lowConfidenceWords,
      });
    }
  }
  return { blocks, meanConfidence: Math.round(data.confidence) };
}
