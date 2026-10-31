import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeParkMapPng, makeToneWav } from '../../prisma/seed/assets';
import { env } from '../../src/config/env';
import { createUser, prisma, resetDb } from '../helpers/db';
import { loginAs } from '../helpers/http';
import { binary, makeZip, readZip, renameEntry } from '../helpers/zip';

const FIXTURES = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'seed', 'fixtures');
const fixtureDoc = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8')) as Record<string, unknown>;

type Agent = Awaited<ReturnType<typeof loginAs>>;

beforeEach(async () => {
  await resetDb();
  await createUser({ email: 'admin@test.local', role: 'ADMIN' });
  await createUser({ email: 'dat@test.local' });
});

async function importListening(agent: Agent, meta: Record<string, unknown> = {}): Promise<string> {
  const doc = {
    ...fixtureDoc('dummy-listening.json'),
    source: 'CAM',
    bookNumber: 18,
    testNumber: 1,
    ...meta,
  };
  let req = agent
    .post('/api/v1/admin/tests/import')
    .attach('files', Buffer.from(JSON.stringify(doc)), 'l.json');
  for (const n of [1, 2, 3, 4]) req = req.attach('files', makeToneWav(1000 + n), `listening-part${n}.wav`);
  req = req.attach('files', makeParkMapPng(), 'park-map.png');
  const res = await req;
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.testId as string;
}

async function importReading(agent: Agent, meta: Record<string, unknown>): Promise<string> {
  const doc = { ...fixtureDoc('dummy-reading.json'), source: 'CAM', ...meta };
  const res = await agent
    .post('/api/v1/admin/tests/import')
    .attach('files', Buffer.from(JSON.stringify(doc)), 'r.json');
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.testId as string;
}

async function download(agent: Agent, url: string) {
  return agent.get(url).buffer(true).parse(binary);
}

/** Every { "path": … } value anywhere in a document. */
function pathsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(pathsIn);
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const own = typeof o.path === 'string' && Object.keys(o).length === 1 ? [o.path] : [];
    return [...own, ...Object.values(o).flatMap(pathsIn)];
  }
  return [];
}

describe('zip export', () => {
  it('exports one test with its media and no file ids', async () => {
    const agent = await loginAs('admin@test.local');
    const id = await importListening(agent, { seriesKey: 'cam18-t1-gt' });

    const res = await download(agent, `/api/v1/admin/tests/${id}/export.zip`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toContain('BandUp-cam18-t1-gt-v1.zip');

    const entries = await readZip(res.body as Buffer);
    const manifest = JSON.parse(entries.get('bandup-export.json')!.toString('utf8'));
    expect(manifest).toMatchObject({
      format: 'bandup-tests',
      formatVersion: 1,
      tests: ['cam18-t1-gt/test.json'],
    });
    const json = entries.get('cam18-t1-gt/test.json')!.toString('utf8');
    expect(json).not.toContain('fileId');
    const refs = pathsIn(JSON.parse(json));
    expect(refs).toHaveLength(5); // 4 audio parts + the map
    for (const p of refs) {
      expect(p).toMatch(/^assets\/[0-9a-f]{8}-[A-Za-z0-9._-]+$/);
      expect(entries.has(`cam18-t1-gt/${p}`), p).toBe(true);
    }
  });

  it('exports a whole set, latest or published only', async () => {
    const agent = await loginAs('admin@test.local');
    const t1 = await importReading(agent, { seriesKey: 'cam18-t1-ac', bookNumber: 18, testNumber: 1 });
    expect((await agent.post(`/api/v1/admin/tests/${t1}/publish`).send({})).status).toBe(200);
    await importReading(agent, { seriesKey: 'cam18-t2-ac', bookNumber: 18, testNumber: 2 });

    const all = await download(agent, '/api/v1/admin/test-sets/CAM-18/export.zip');
    expect(all.status).toBe(200);
    expect(all.headers['content-disposition']).toMatch(/BandUp-CAM-18-\d{4}-\d{2}-\d{2}\.zip/);
    const manifest = JSON.parse(
      (await readZip(all.body as Buffer)).get('bandup-export.json')!.toString('utf8'),
    );
    expect(manifest.tests).toEqual(['cam18-t1-ac/test.json', 'cam18-t2-ac/test.json']);

    const pub = await download(agent, '/api/v1/admin/test-sets/CAM-18/export.zip?include=published');
    const pubManifest = JSON.parse(
      (await readZip(pub.body as Buffer)).get('bandup-export.json')!.toString('utf8'),
    );
    expect(pubManifest.tests).toEqual(['cam18-t1-ac/test.json']);
  });

  it('reports unknown tests and sets', async () => {
    const agent = await loginAs('admin@test.local');
    const unknownTest = await agent.get(
      '/api/v1/admin/tests/0190f0c0-0000-7000-8000-000000000000/export.zip',
    );
    expect(unknownTest.status).toBe(404);
    expect((await agent.get('/api/v1/admin/test-sets/CAM-18/export.zip')).status).toBe(404);
    expect((await agent.get('/api/v1/admin/test-sets/CAM-..%2Fx/export.zip')).status).toBe(400);
  });
});

async function importZip(agent: Agent, zip: Buffer, dryRun = false) {
  return agent
    .post(`/api/v1/admin/tests/import-zip${dryRun ? '/validate' : ''}`)
    .attach('file', zip, 'tests.zip');
}

/** test.json of the only test in an exported zip. */
async function exportedDoc(agent: Agent, testId: string) {
  const res = await download(agent, `/api/v1/admin/tests/${testId}/export.zip`);
  const entries = await readZip(res.body as Buffer);
  const name = [...entries.keys()].find((k) => k.endsWith('/test.json')) ?? '';
  return { entries, folder: name.split('/')[0] ?? '', json: entries.get(name)?.toString('utf8') };
}

function listeningZipEntries(folder: string, seriesKey: string, seed: number) {
  const doc = { ...fixtureDoc('dummy-listening.json'), seriesKey };
  const entries: Record<string, Buffer | string> = { [`${folder}/test.json`]: JSON.stringify(doc) };
  for (const n of [1, 2, 3, 4]) entries[`${folder}/assets/listening-part${n}.wav`] = makeToneWav(seed + n);
  entries[`${folder}/assets/park-map.png`] = makeParkMapPng();
  return entries;
}

describe('zip import', () => {
  it('round-trips a test with media', async () => {
    const agent = await loginAs('admin@test.local');
    const id = await importListening(agent, { seriesKey: 'cam18-t1-gt' });
    const zip = (await download(agent, `/api/v1/admin/tests/${id}/export.zip`)).body as Buffer;

    const res = await importZip(agent, zip);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.items).toEqual([
      { seriesKey: 'cam18-t1-gt', file: 'cam18-t1-gt/test.json', ok: true, testId: expect.any(String) },
    ]);
    const again = await exportedDoc(agent, res.body.items[0].testId as string);
    expect(again.json).toBe((await exportedDoc(agent, id)).json);
  });

  it('imports as a new draft version', async () => {
    const agent = await loginAs('admin@test.local');
    const id = await importListening(agent, { seriesKey: 'cam18-t1-gt' });
    expect((await agent.post(`/api/v1/admin/tests/${id}/publish`).send({})).status).toBe(200);
    const zip = (await download(agent, `/api/v1/admin/tests/${id}/export.zip`)).body as Buffer;

    const res = await importZip(agent, zip);
    const created = await prisma.test.findUniqueOrThrow({
      where: { id: res.body.items[0].testId as string },
    });
    expect(created).toMatchObject({ status: 'DRAFT', version: 2 });
    expect((await prisma.test.findUniqueOrThrow({ where: { id } })).status).toBe('PUBLISHED');
  });

  it('keeps assets of different tests apart', async () => {
    const agent = await loginAs('admin@test.local');
    const zip = await makeZip({
      ...listeningZipEntries('a', 'series-a', 1000),
      ...listeningZipEntries('b', 'series-b', 2000),
    });

    const res = await importZip(agent, zip);
    expect(res.body.items.map((i: { ok: boolean }) => i.ok)).toEqual([true, true]);
    for (const [i, seed] of [
      [0, 1000],
      [1, 2000],
    ] as const) {
      const { entries, folder } = await exportedDoc(agent, res.body.items[i].testId as string);
      const part1 = [...entries.keys()].find(
        (k) => k.startsWith(`${folder}/assets/`) && k.endsWith('listening-part1.wav'),
      );
      expect(part1).toBeDefined();
      expect(entries.get(part1 ?? '')?.equals(makeToneWav(seed + 1))).toBe(true);
    }
  });

  it('one bad test does not block the others', async () => {
    const agent = await loginAs('admin@test.local');
    const good = { ...fixtureDoc('dummy-reading.json'), seriesKey: 'good-one' };
    const bad = { ...fixtureDoc('dummy-reading.json'), seriesKey: 'bad-one', title: '' };
    const zip = await makeZip({
      'good/test.json': JSON.stringify(good),
      'bad/test.json': JSON.stringify(bad),
    });
    const res = await importZip(agent, zip);
    expect(res.status).toBe(201);
    const byKey = Object.fromEntries(
      (res.body.items as { seriesKey: string; ok: boolean; file: string; issues?: { path: string }[] }[]).map(
        (i) => [i.seriesKey, i],
      ),
    ) as Record<string, { ok: boolean; file: string; issues?: { path: string }[] }>;
    expect(byKey['good-one']?.ok).toBe(true);
    expect(byKey['bad-one']).toMatchObject({ ok: false, file: 'bad/test.json' });
    expect(byKey['bad-one']?.issues?.[0]?.path).toBe('title');
    expect(await prisma.test.count()).toBe(1);
  });

  it('imports zips without a manifest: folder test.json and root json files', async () => {
    const agent = await loginAs('admin@test.local');
    const x = { ...fixtureDoc('dummy-reading.json'), seriesKey: 'from-folder' };
    const y = { ...fixtureDoc('dummy-reading.json'), seriesKey: 'from-root' };
    const res = await importZip(
      agent,
      await makeZip({ 'x/test.json': JSON.stringify(x), 'y.json': JSON.stringify(y) }),
    );
    const got = (res.body.items as { seriesKey: string; ok: boolean }[]).map((i) => `${i.seriesKey}:${i.ok}`);
    expect(got.sort()).toEqual(['from-folder:true', 'from-root:true']);
  });

  it('validates without storing anything', async () => {
    const agent = await loginAs('admin@test.local');
    const doc = { ...fixtureDoc('dummy-reading.json'), seriesKey: 'dry-run' };
    const res = await importZip(agent, await makeZip({ 'd/test.json': JSON.stringify(doc) }), true);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ seriesKey: 'dry-run', file: 'd/test.json', ok: true }]);
    expect(await prisma.test.count()).toBe(0);
  });

  describe('rejects hostile zips and imports nothing', () => {
    const reading = JSON.stringify(fixtureDoc('dummy-reading.json'));
    const cases: [string, () => Promise<Buffer>][] = [
      [
        'a parent-directory entry',
        async () => renameEntry(await makeZip({ 'aa/evil.json': reading }), 'aa/evil.json', '../evil.json'),
      ],
      [
        'an absolute entry',
        async () => renameEntry(await makeZip({ 'xabs.json': reading }), 'xabs.json', '/abs.json'),
      ],
      ['a non-test file type', () => makeZip({ 'ok/test.json': reading, 'ok/assets/notes.exe': 'MZ' })],
      [
        'too many entries',
        () => makeZip(Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`f${i}.json`, '{}']))),
      ],
    ];

    it.each(cases)('%s', async (_name, build) => {
      const agent = await loginAs('admin@test.local');
      const res = await importZip(agent, await build());
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('IMPORT_INVALID');
      expect(await prisma.test.count()).toBe(0);
    });

    it('more uncompressed data than allowed (zip bomb)', async () => {
      const agent = await loginAs('admin@test.local');
      const before = env.UPLOAD_MAX_ZIP_MB;
      env.UPLOAD_MAX_ZIP_MB = 1;
      try {
        const res = await importZip(
          agent,
          await makeZip({ 'big/test.json': Buffer.alloc(2 * 1_048_576, 32) }),
        );
        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('IMPORT_INVALID');
      } finally {
        env.UPLOAD_MAX_ZIP_MB = before;
      }
      expect(await prisma.test.count()).toBe(0);
    });
  });
});
