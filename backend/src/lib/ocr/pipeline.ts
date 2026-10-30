// OCR pipeline (spec §6 P2): images → sharp preprocessing → tesseract.js; PDF with a text layer → pdfjs text;
// scanned PDF pages → rendered with pdfjs → tesseract. Pure: no DB, no storage — the OCR job service persists results.
import sharp from 'sharp';
import type { OcrMethod } from '../../shared/enums';
import type { OcrBlock } from '../../shared/ocr';
import { openPdf } from './pdf';
import { recognize } from './tesseract';

export interface OcrSource {
  bytes: Buffer;
  mimeType: string;
}

export interface OcrPageResult {
  /** PNG shown on the left of the review screen. */
  image: Buffer;
  widthPx: number;
  heightPx: number;
  method: Extract<OcrMethod, 'PDF_TEXT' | 'TESSERACT'>;
  meanConfidence: number | null;
  blocks: OcrBlock[];
}

/** A PDF page "has text" when its text layer holds a reasonable amount of characters. */
const MIN_TEXT_CHARS = 40;
const MAX_DISPLAY_WIDTH = 1800;

/** Upright, display-sized PNG of an image (EXIF orientation applied, plus an optional manual rotation). */
async function displayImage(bytes: Buffer, rotation = 0) {
  const { data, info } = await sharp(bytes)
    .rotate() // EXIF
    .rotate(rotation)
    .resize({ width: MAX_DISPLAY_WIDTH, withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { png: data, width: info.width, height: info.height };
}

/** Greyscale + contrast stretch + upscale small scans: noticeably better tesseract accuracy on phone photos. */
async function ocrImage(png: Buffer, width: number): Promise<Buffer> {
  const pipeline = sharp(png).greyscale().normalise();
  return (width < 1500 ? pipeline.resize({ width: width * 2 }) : pipeline).png().toBuffer();
}

async function ocrPage(display: { png: Buffer; width: number; height: number }): Promise<OcrPageResult> {
  const input = await ocrImage(display.png, display.width);
  const meta = await sharp(input).metadata();
  const { blocks, meanConfidence } = await recognize(input, { width: meta.width, height: meta.height });
  return {
    image: display.png,
    widthPx: display.width,
    heightPx: display.height,
    method: 'TESSERACT',
    meanConfidence,
    blocks,
  };
}

/** Re-OCR one page image after a manual rotation (review screen "Xoay trang"). */
export async function reocrImage(png: Buffer, rotation: number): Promise<OcrPageResult> {
  return ocrPage(await displayImage(png, rotation));
}

export async function runOcr(
  sources: OcrSource[],
  opts: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<OcrPageResult[]> {
  const results: OcrPageResult[] = [];
  const check = () => {
    if (opts.signal?.aborted) throw new Error('OCR bị hủy (quá thời gian hoặc server đang tắt)');
  };
  for (const src of sources) {
    check();
    if (src.mimeType === 'application/pdf') {
      const pdf = await openPdf(src.bytes);
      try {
        for (const page of pdf.pages) {
          check();
          const chars = page.textBlocks.reduce((n, b) => n + b.text.length, 0);
          if (chars >= MIN_TEXT_CHARS) {
            const shown = await page.render(1.5);
            results.push({
              image: shown.png,
              widthPx: shown.width,
              heightPx: shown.height,
              method: 'PDF_TEXT',
              meanConfidence: null,
              blocks: page.textBlocks,
            });
          } else {
            results.push(await ocrPage(await page.render(2.5)));
          }
          opts.onProgress?.(results.length, Math.max(results.length, sources.length));
        }
      } finally {
        await pdf.destroy();
      }
    } else {
      results.push(await ocrPage(await displayImage(src.bytes)));
      opts.onProgress?.(results.length, sources.length);
    }
  }
  return results;
}

export function overallMethod(pages: OcrPageResult[]): OcrMethod {
  const methods = new Set(pages.map((p) => p.method));
  return methods.size > 1 ? 'MIXED' : (pages[0]?.method ?? 'TESSERACT');
}
