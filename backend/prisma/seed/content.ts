import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Db } from '../../src/config/prisma';
import { storage } from '../../src/lib/storage';
import { checkPublishable, type FileRef } from '../../src/shared/test-import';
import type { FilePurpose } from '../../src/shared/enums';
import { importTest, parseTestImport, type FileResolver } from '../../src/modules/tests/import.service';
import { makeFerryChartPng, makeParkMapPng, makeToneWav } from './assets';

const FIXTURES = ['dummy-reading.json', 'dummy-listening.json', 'dummy-writing.json', 'dummy-speaking.json'];

interface GeneratedAsset {
  bytes: Buffer;
  mimeType: string;
  ext: string;
  widthPx?: number;
  heightPx?: number;
  durationMs?: number;
}

/** Fixture `assets/...` paths → bytes generated in code. */
function generatedAssets(): Record<string, GeneratedAsset> {
  const wav = (n: number): GeneratedAsset => ({
    bytes: makeToneWav(20_000 + n),
    mimeType: 'audio/wav',
    ext: 'wav',
    durationMs: 20_000,
  });
  return {
    'assets/listening-part1.wav': wav(1),
    'assets/listening-part2.wav': wav(2),
    'assets/listening-part3.wav': wav(3),
    'assets/listening-part4.wav': wav(4),
    'assets/park-map.png': {
      bytes: makeParkMapPng(),
      mimeType: 'image/png',
      ext: 'png',
      widthPx: 800,
      heightPx: 560,
    },
    'assets/task1-ferry-chart.png': {
      bytes: makeFerryChartPng(),
      mimeType: 'image/png',
      ext: 'png',
      widthPx: 800,
      heightPx: 500,
    },
  };
}

function makeResolver(prisma: Db, adminId: string): FileResolver {
  const assets = generatedAssets();
  return async (ref: FileRef, purpose: FilePurpose, at: string) => {
    if ('fileId' in ref) return ref.fileId;
    const asset = assets[ref.path];
    if (!asset) throw new Error(`${at}: không có asset sinh sẵn cho ${ref.path}`);
    const sha256 = createHash('sha256').update(asset.bytes).digest('hex');
    // Reuse an identical file (same content + purpose) so re-seeding never duplicates storage.
    const existing = await prisma.storedFile.findFirst({ where: { sha256, purpose } });
    if (existing) return existing.id;
    const now = new Date();
    const storageKey = `${purpose.toLowerCase()}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${asset.ext}`;
    const { sizeBytes } = await storage.put(storageKey, asset.bytes);
    const row = await prisma.storedFile.create({
      data: {
        storageKey,
        purpose,
        mimeType: asset.mimeType,
        originalName: path.basename(ref.path),
        sizeBytes,
        sha256,
        widthPx: asset.widthPx ?? null,
        heightPx: asset.heightPx ?? null,
        durationMs: asset.durationMs ?? null,
        uploadedById: adminId,
      },
    });
    return row.id;
  };
}

/** Imports each dummy test once (keyed by seriesKey + version 1). Fixtures go through the real importer. */
export async function seedDummyTests(prisma: Db, adminId: string): Promise<void> {
  const resolveFile = makeResolver(prisma, adminId);
  for (const name of FIXTURES) {
    const raw: unknown = JSON.parse(
      await fs.readFile(path.join(import.meta.dirname, 'fixtures', name), 'utf8'),
    );
    const doc = parseTestImport(raw, { requirePublishable: false });
    const exists = await prisma.test.findUnique({
      where: { seriesKey_version: { seriesKey: doc.seriesKey, version: 1 } },
    });
    if (exists) {
      console.log(`  • đề ${doc.seriesKey} đã có (${exists.status})`);
      continue;
    }
    const status = checkPublishable(doc).length === 0 ? 'PUBLISHED' : 'DRAFT';
    await importTest(doc, { status, resolveFile, createdById: adminId });
    console.log(`  • đã nhập đề ${doc.seriesKey} (${status})`);
  }
}
