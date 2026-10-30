import { createRequire } from 'node:module';
import path from 'node:path';
import type { createCanvas as CreateCanvas } from '@napi-rs/canvas';
import type * as PdfJsModule from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { OcrBlock } from '../../shared/ocr';

// pdfjs-dist 4.x (Apache-2.0): the "legacy" build is the one meant for Node. Version 5+ needs Node 22.
type PdfJs = typeof PdfJsModule;
let pdfjs: PdfJs | null = null;
const require = createRequire(import.meta.url);
// In Node pdfjs reads these with fs.readFile(base + name): a plain directory path (not a file:// URL).
const STANDARD_FONTS = `${path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')}${path.sep}`;

async function lib(): Promise<PdfJs> {
  if (!pdfjs) {
    // pdfjs draws glyphs with Path2D and reads DOMMatrix/ImageData globals, which Node lacks: provide the
    // @napi-rs/canvas implementations (the same canvas pdfjs' NodeCanvasFactory uses) before loading it.
    const canvas = require('@napi-rs/canvas') as Record<string, unknown>;
    const g = globalThis as Record<string, unknown>;
    for (const name of ['Path2D', 'DOMMatrix', 'ImageData']) g[name] ??= canvas[name];
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjs;
}

export interface PdfPage {
  pageNumber: number;
  /** Text-layer blocks; empty for scanned pages. */
  textBlocks: OcrBlock[];
  render(scale: number): Promise<{ png: Buffer; width: number; height: number }>;
}

interface TextItem {
  str: string;
  transform: number[];
  height: number;
  width: number;
}

/** Group text items into lines (same baseline) and lines into blocks (vertical gap > 1.2 line heights). */
function textToBlocks(items: TextItem[], pageW: number, pageH: number): OcrBlock[] {
  const lines: { y: number; x0: number; x1: number; h: number; text: string }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const x = it.transform[4] ?? 0;
    const y = pageH - (it.transform[5] ?? 0); // pdf origin is bottom-left
    const h = it.height || 10;
    const line = lines.find((l) => Math.abs(l.y - y) < h * 0.5);
    if (line) {
      line.text += (x - line.x1 > h * 0.15 ? ' ' : '') + it.str;
      line.x0 = Math.min(line.x0, x);
      line.x1 = Math.max(line.x1, x + it.width);
    } else {
      lines.push({ y, x0: x, x1: x + it.width, h, text: it.str });
    }
  }
  lines.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const blocks: OcrBlock[] = [];
  let cur: { lines: typeof lines } | null = null;
  const flush = () => {
    if (!cur) return;
    const ls = cur.lines;
    const x0 = Math.min(...ls.map((l) => l.x0));
    const x1 = Math.max(...ls.map((l) => l.x1));
    const y0 = Math.min(...ls.map((l) => l.y - l.h));
    const y1 = Math.max(...ls.map((l) => l.y));
    blocks.push({
      id: `b${blocks.length + 1}`,
      bbox: { x: x0 / pageW, y: y0 / pageH, w: (x1 - x0) / pageW, h: (y1 - y0) / pageH },
      text: ls.map((l) => l.text.trim()).join('\n'),
      confidence: null,
      lowConfidenceWords: [],
    });
    cur = null;
  };
  for (const l of lines) {
    const prev = cur?.lines.at(-1);
    if (prev && l.y - prev.y > prev.h * 1.8) flush();
    cur ??= { lines: [] };
    cur.lines.push(l);
  }
  flush();
  return blocks;
}

export async function openPdf(bytes: Buffer): Promise<{ pages: PdfPage[]; destroy: () => Promise<void> }> {
  const { getDocument } = await lib();
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: STANDARD_FONTS,
    isEvalSupported: false,
    useSystemFonts: false,
    // Keep glyph outlines on the main thread: Node has no FontFace, so text is drawn as paths.
    fontExtraProperties: true,
  }).promise;
  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((i): i is TextItem & typeof i => 'str' in i) as unknown as TextItem[];
    pages.push({
      pageNumber: n,
      textBlocks: textToBlocks(items, viewport.width, viewport.height),
      async render(scale) {
        const vp = page.getViewport({ scale });
        const { createCanvas } = require('@napi-rs/canvas') as { createCanvas: typeof CreateCanvas };
        const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        type RenderParams = Parameters<typeof page.render>[0];
        // pdfjs types the context as the DOM CanvasRenderingContext2D, which does not exist without the DOM lib.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion
        await page.render({ canvasContext: ctx as unknown as RenderParams['canvasContext'], viewport: vp })
          .promise;
        return { png: canvas.toBuffer('image/png'), width: canvas.width, height: canvas.height };
      },
    });
  }
  return { pages, destroy: () => doc.destroy() };
}
