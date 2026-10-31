// Export tests as a .zip a BandUp install can import again:
//   bandup-export.json · <seriesKey>/test.json · <seriesKey>/assets/<fileId first 8>-<original name>
// File references are rewritten from { fileId } to { path }; the media is streamed from Storage into the zip.
import type { Writable } from 'node:stream';
import yazl from 'yazl';
import { prisma } from '../../config/prisma';
import { notFound } from '../../lib/errors';
import { storage } from '../../lib/storage';
import type { TestImportDoc } from '../../shared/test-import';
import { exportTest } from './export.service';

export const EXPORT_FORMAT = { format: 'bandup-tests', formatVersion: 1 } as const;

const safeName = (name: string | null) =>
  (name ?? '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/^[._]+/, '') || 'file';

export const assetPathOf = (fileId: string, originalName: string | null) =>
  `assets/${fileId.replace(/-/g, '').slice(0, 8)}-${safeName(originalName)}`;

function isFileIdRef(v: unknown): v is { fileId: string } {
  return (
    !!v &&
    typeof v === 'object' &&
    Object.keys(v).length === 1 &&
    typeof (v as { fileId?: unknown }).fileId === 'string'
  );
}

/** Every fileId referenced anywhere in the document. */
export function fileIdsIn(value: unknown): string[] {
  if (isFileIdRef(value)) return [value.fileId];
  if (Array.isArray(value)) return value.flatMap(fileIdsIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(fileIdsIn);
  return [];
}

/** Copy of the document with every { fileId } replaced by { path: "assets/…" }. */
export function docWithAssetPaths(doc: TestImportDoc, names: Map<string, string | null>): TestImportDoc {
  const walk = (v: unknown): unknown => {
    if (isFileIdRef(v)) return { path: assetPathOf(v.fileId, names.get(v.fileId) ?? null) };
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(doc) as TestImportDoc;
}

export const zipExportService = {
  /** "BandUp-<seriesKey>-v<version>.zip" for a single test. */
  async testFileName(testId: string): Promise<string> {
    const t = await prisma.test.findUnique({
      where: { id: testId },
      select: { seriesKey: true, version: true },
    });
    if (!t) throw notFound('Đề');
    return `BandUp-${t.seriesKey}-v${t.version}.zip`;
  },

  /** Write a zip of the given tests to `out`; resolves when the zip has been fully written. */
  async streamZip(testIds: string[], out: Writable): Promise<void> {
    const zip = new yazl.ZipFile();
    const done = new Promise<void>((resolve, reject) => {
      zip.outputStream.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
    });
    zip.outputStream.pipe(out);

    const listed: string[] = [];
    for (const id of testIds) {
      const doc = await exportTest(id);
      const ids = [...new Set(fileIdsIn(doc))];
      const files = await prisma.storedFile.findMany({
        where: { id: { in: ids } },
        select: { id: true, storageKey: true, originalName: true },
      });
      const names = new Map(files.map((f) => [f.id, f.originalName]));
      const folder = doc.seriesKey;
      zip.addBuffer(
        Buffer.from(JSON.stringify(docWithAssetPaths(doc, names), null, 2)),
        `${folder}/test.json`,
      );
      for (const f of files) {
        zip.addReadStream(
          await storage.getStream(f.storageKey),
          `${folder}/${assetPathOf(f.id, f.originalName)}`,
        );
      }
      listed.push(`${folder}/test.json`);
    }
    zip.addBuffer(
      Buffer.from(
        JSON.stringify({ ...EXPORT_FORMAT, exportedAt: new Date().toISOString(), tests: listed }, null, 2),
      ),
      'bandup-export.json',
    );
    zip.end();
    await done;
  },
};
