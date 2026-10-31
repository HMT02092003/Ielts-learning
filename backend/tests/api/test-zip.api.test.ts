import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeParkMapPng, makeToneWav } from '../../prisma/seed/assets';
import { createUser, resetDb } from '../helpers/db';
import { loginAs } from '../helpers/http';
import { binary, readZip } from '../helpers/zip';

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
