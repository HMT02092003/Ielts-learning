import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDb } from '../helpers/db';
import { loginAs } from '../helpers/http';

const FIXTURES = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'seed', 'fixtures');
const readingDoc = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, 'dummy-reading.json'), 'utf8')) as Record<string, unknown>;

beforeEach(async () => {
  await resetDb();
  await createUser({ email: 'admin@test.local', role: 'ADMIN' });
  await createUser({ email: 'dat@test.local' });
});

type Agent = Awaited<ReturnType<typeof loginAs>>;

/** Import the reading fixture under another series/book; returns the new test id. */
async function importAs(
  agent: Agent,
  meta: { seriesKey: string; source?: string; bookNumber?: number | null; testNumber?: number | null },
  mutate?: (doc: Record<string, unknown>) => void,
): Promise<string> {
  const doc = { ...readingDoc(), source: 'CAM', ...meta };
  if (doc.bookNumber === null) delete doc.bookNumber;
  if (doc.testNumber === null) delete doc.testNumber;
  mutate?.(doc);
  const res = await agent
    .post('/api/v1/admin/tests/import')
    .attach('files', Buffer.from(JSON.stringify(doc)), 'test.json');
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.testId as string;
}

describe('test sets', () => {
  it('groups versions per series', async () => {
    const agent = await loginAs('admin@test.local');
    const a1 = await importAs(agent, { seriesKey: 'cam18-t1-ac', bookNumber: 18, testNumber: 1 });
    expect((await agent.post(`/api/v1/admin/tests/${a1}/publish`).send({})).status).toBe(200);
    const a2 = await importAs(agent, { seriesKey: 'cam18-t1-ac', bookNumber: 18, testNumber: 1 });
    const b1 = await importAs(agent, { seriesKey: 'cam18-t2-ac', bookNumber: 18, testNumber: 2 });

    const res = await agent.get('/api/v1/admin/test-sets');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const [set] = res.body;
    expect(set).toMatchObject({
      setKey: 'CAM-18',
      title: 'Cambridge 18',
      counts: { draft: 2, published: 1 },
    });
    expect(set.tests.map((t: { seriesKey: string }) => t.seriesKey)).toEqual(['cam18-t1-ac', 'cam18-t2-ac']);
    expect(set.tests[0].latest).toMatchObject({ id: a2, version: 2, status: 'DRAFT', skills: ['READING'] });
    expect(set.tests[0].published).toEqual({ id: a1, version: 1 });
    expect(set.tests[1].latest.id).toBe(b1);
    expect(set.tests[1].published).toBeNull();

    const student = await loginAs('dat@test.local');
    const mine = await student.get('/api/v1/tests/sets');
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].tests.map((t: { id: string }) => t.id)).toEqual([a1]);
  });

  it('puts tests without a book in a loose set, sorted after numbered books', async () => {
    const agent = await loginAs('admin@test.local');
    await importAs(agent, { seriesKey: 'loose-one', bookNumber: null });
    await importAs(agent, { seriesKey: 'cam17-t1-ac', bookNumber: 17, testNumber: 1 });
    await importAs(agent, { seriesKey: 'cam19-t3-ac', bookNumber: 19, testNumber: 3 });
    await importAs(agent, { seriesKey: 'cam19-t1-ac', bookNumber: 19, testNumber: 1 });
    await importAs(agent, { seriesKey: 'vol2-t1-ac', source: 'VOL', bookNumber: 2, testNumber: 1 });

    const res = await agent.get('/api/v1/admin/test-sets');
    expect(res.body.map((s: { setKey: string }) => s.setKey)).toEqual([
      'CAM-19',
      'CAM-17',
      'CAM-none',
      'VOL-2',
    ]);
    expect(res.body[0].tests.map((t: { testNumber: number }) => t.testNumber)).toEqual([1, 3]);
    expect(res.body[2].title).toBe('Cambridge — đề lẻ');

    const filtered = await agent.get('/api/v1/admin/test-sets?source=VOL');
    expect(filtered.body.map((s: { setKey: string }) => s.setKey)).toEqual(['VOL-2']);
  });

  it('hides sets without a published test from students', async () => {
    const agent = await loginAs('admin@test.local');
    await importAs(agent, { seriesKey: 'cam18-t1-ac', bookNumber: 18, testNumber: 1 });
    const student = await loginAs('dat@test.local');
    expect((await student.get('/api/v1/tests/sets')).body).toEqual([]);
  });

  it('keeps students out of the admin listing', async () => {
    const student = await loginAs('dat@test.local');
    expect((await student.get('/api/v1/admin/test-sets')).status).toBe(404);
  });
});
