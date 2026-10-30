import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeFerryChartPng, makeParkMapPng, makeToneWav } from '../../prisma/seed/assets';
import { ocrService } from '../../src/modules/ocr/ocr.service';
import { createUser, prisma, resetDb } from '../helpers/db';
import { app, loginAs } from '../helpers/http';

const FIXTURES = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'seed', 'fixtures');
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name));

beforeEach(async () => {
  await resetDb();
  await createUser({ email: 'admin@test.local', role: 'ADMIN' });
  await createUser({ email: 'dat@test.local' });
});

const admin = () => loginAs('admin@test.local');

async function importReading() {
  const agent = await admin();
  const res = await agent
    .post('/api/v1/admin/tests/import')
    .attach('files', fixture('dummy-reading.json'), 'reading.json');
  expect(res.status).toBe(201);
  return { agent, testId: res.body.testId as string };
}

describe('admin users', () => {
  it('creates, lists, deactivates and resets a user', async () => {
    const agent = await admin();
    const created = await agent
      .post('/api/v1/admin/users')
      .send({ email: 'New@Test.local', displayName: 'Mới', password: '123456789' });
    expect(created.status).toBe(201);
    expect(created.body.email).toBe('new@test.local');

    const dup = await agent
      .post('/api/v1/admin/users')
      .send({ email: 'new@test.local', displayName: 'x', password: '123456789' });
    expect(dup.body.error.code).toBe('CONFLICT');

    const list = await agent.get('/api/v1/admin/users?q=new');
    expect(list.body.total).toBe(1);

    const off = await agent.patch(`/api/v1/admin/users/${created.body.id}`).send({ isActive: false });
    expect(off.body.isActive).toBe(false);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'new@test.local', password: '123456789' });
    expect(login.body.error.code).toBe('AUTH_ACCOUNT_DISABLED');

    const reset = await agent
      .post(`/api/v1/admin/users/${created.body.id}/reset-password`)
      .send({ newPassword: 'abcdefgh9' });
    expect(reset.status).toBe(204);
  });

  it('refuses to remove the last admin', async () => {
    const agent = await admin();
    const me = await agent.get('/api/v1/auth/me');
    const res = await agent.patch(`/api/v1/admin/users/${me.body.id}`).send({ role: 'STUDENT' });
    expect(res.body.error.code).toBe('LAST_ADMIN');
  });

  it('students cannot reach admin users (404)', async () => {
    const agent = await loginAs('dat@test.local');
    expect((await agent.get('/api/v1/admin/users')).status).toBe(404);
  });
});

describe('admin tests: import, edit, publish', () => {
  it('validate (dry run) reports path-precise errors and stores nothing', async () => {
    const agent = await admin();
    const doc = JSON.parse(fixture('dummy-reading.json').toString('utf8')) as {
      reading: { passages: { groups: { questions: { answer: unknown }[] }[] }[] };
    };
    const q = doc.reading.passages[2]?.groups[1]?.questions[0];
    if (!q) throw new Error('fixture shape changed');
    q.answer = 'Z';
    const res = await agent
      .post('/api/v1/admin/tests/import/validate')
      .attach('files', Buffer.from(JSON.stringify(doc)), 'bad.json');
    expect(res.body.error.code).toBe('IMPORT_INVALID');
    expect(res.body.error.details.issues.map((i: { path: string }) => i.path)).toContain(
      'reading.passages[2].groups[1].questions[0].answer',
    );
    expect(await prisma.test.count()).toBe(0);
  });

  it('import → JSON export round-trips → publish → clone', async () => {
    const { agent, testId } = await importReading();
    const detail = await agent.get(`/api/v1/admin/tests/${testId}`);
    expect(detail.body.test.status).toBe('DRAFT');
    expect(detail.body.publishIssues).toEqual([]);

    // The JSON editor saves the exported document back unchanged.
    const saved = await agent.put(`/api/v1/admin/tests/${testId}/content`).send({ doc: detail.body.doc });
    expect(saved.status).toBe(200);
    expect(await prisma.question.count({ where: { section: { testId } } })).toBe(40);

    const pub = await agent.post(`/api/v1/admin/tests/${testId}/publish`).send({});
    expect(pub.body.status).toBe('PUBLISHED');

    const locked = await agent.put(`/api/v1/admin/tests/${testId}/content`).send({ doc: detail.body.doc });
    expect(locked.body.error.code).toBe('TEST_LOCKED');

    const clone = await agent.post(`/api/v1/admin/tests/${testId}/clone`).send({});
    expect(clone.status).toBe(201);
    const v2 = await prisma.test.findUniqueOrThrow({ where: { id: clone.body.testId } });
    expect(v2).toMatchObject({ version: 2, status: 'DRAFT' });

    // Publishing v2 archives v1 (one published version per series).
    await agent.post(`/api/v1/admin/tests/${v2.id}/publish`).send({});
    const v1 = await prisma.test.findUniqueOrThrow({ where: { id: testId } });
    expect(v1.status).toBe('ARCHIVED');
  });

  it('hotfixes accepted answers of a published question', async () => {
    const { agent, testId } = await importReading();
    await agent.post(`/api/v1/admin/tests/${testId}/publish`).send({});
    const qs = await agent.get(`/api/v1/admin/tests/${testId}/questions`);
    const q6 = qs.body.find((q: { number: number }) => q.number === 6);
    const res = await agent
      .patch(`/api/v1/admin/tests/${testId}/questions/${q6.id}`)
      .send({ acceptedAnswers: ['honey', 'the honey'] });
    expect(res.status).toBe(204);
    const row = await prisma.question.findUniqueOrThrow({ where: { id: q6.id } });
    expect(row.acceptedAnswers).toEqual(['honey', 'the honey']);
  });

  it('imports a listening test with uploaded assets and reports a missing one', async () => {
    const agent = await admin();
    const missing = await agent
      .post('/api/v1/admin/tests/import')
      .attach('files', fixture('dummy-listening.json'), 'l.json');
    expect(missing.body.error.details.issues[0].code).toBe('asset_missing');

    let req = agent
      .post('/api/v1/admin/tests/import')
      .attach('files', fixture('dummy-listening.json'), 'l.json');
    for (const n of [1, 2, 3, 4]) req = req.attach('files', makeToneWav(1000 + n), `listening-part${n}.wav`);
    req = req.attach('files', makeParkMapPng(), 'park-map.png');
    const ok = await req;
    expect(ok.status).toBe(201);
  });
});

describe('files', () => {
  it('rejects a file whose bytes do not match an allowed type', async () => {
    const agent = await admin();
    const res = await agent
      .post('/api/v1/admin/files')
      .field('purpose', 'TEST_IMAGE')
      .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'evil.png');
    expect(res.body.error.code).toBe('FILE_SIGNATURE_MISMATCH');
  });

  it('serves audio with byte ranges; students only see media of published tests', async () => {
    const agent = await admin();
    const up = await agent
      .post('/api/v1/admin/files')
      .field('purpose', 'TEST_AUDIO')
      .attach('file', makeToneWav(2000), 'a.wav');
    expect(up.status).toBe(201);
    expect(up.body.durationMs).toBeGreaterThan(1500);
    const id = up.body.id as string;

    const full = await agent.get(`/api/v1/files/${id}`);
    expect(full.status).toBe(200);
    const part = await agent.get(`/api/v1/files/${id}`).set('Range', 'bytes=0-99');
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe(`bytes 0-99/${up.body.sizeBytes}`);
    const bad = await agent
      .get(`/api/v1/files/${id}`)
      .set('Range', `bytes=${Number(up.body.sizeBytes) + 10}-`);
    expect(bad.status).toBe(416);

    const student = await loginAs('dat@test.local');
    expect((await student.get(`/api/v1/files/${id}`)).status).toBe(404); // not used by any published test
  });

  it('deduplicates identical uploads', async () => {
    const agent = await admin();
    const png = makeFerryChartPng();
    const a = await agent
      .post('/api/v1/admin/files')
      .field('purpose', 'TEST_IMAGE')
      .attach('file', png, 'a.png');
    const b = await agent
      .post('/api/v1/admin/files')
      .field('purpose', 'TEST_IMAGE')
      .attach('file', png, 'b.png');
    expect(a.body.id).toBe(b.body.id);
  });
});

describe('OCR jobs', () => {
  it('upload → background OCR → review draft → assemble → publish as DRAFT test', async () => {
    const agent = await admin();
    const c = createCanvas(1400, 700);
    const g = c.getContext('2d');
    g.fillStyle = 'white';
    g.fillRect(0, 0, 1400, 700);
    g.fillStyle = 'black';
    g.font = '34px sans-serif';
    g.fillText('Questions 1-2', 60, 80);
    g.fillText('Do the following statements agree with the information?', 60, 130);
    g.fillText('1 Bees prefer rooftops to parks.', 60, 260);
    g.fillText('2 The honey tastes the same everywhere.', 60, 320);

    const created = await agent
      .post('/api/v1/admin/ocr-jobs')
      .attach('files', c.toBuffer('image/png'), 'page1.png');
    expect(created.status).toBe(202);
    const jobId = created.body.id as string;

    // Run the worker step synchronously (the background worker is disabled in tests).
    await ocrService.processNext(new AbortController().signal);
    const job = await agent.get(`/api/v1/admin/ocr-jobs/${jobId}`);
    expect(job.body.status).toBe('NEEDS_REVIEW');
    expect(job.body.pages).toHaveLength(1);
    const text = job.body.reviewDraft.blocks.map((b: { text: string }) => b.text).join('\n');
    expect(text).toMatch(/Questions 1-2/);

    // Page image is admin-only.
    const pageImg = job.body.pages[0].imageFileId as string;
    expect((await agent.get(`/api/v1/files/${pageImg}`)).status).toBe(200);
    expect((await (await loginAs('dat@test.local')).get(`/api/v1/files/${pageImg}`)).status).toBe(404);

    const draft = { ...job.body.reviewDraft, answerKey: { '1': ['FALSE'], '2': ['NOT GIVEN'] } };
    const saved = await agent
      .put(`/api/v1/admin/ocr-jobs/${jobId}/review`)
      .send({ draftVersion: job.body.draftVersion, draft });
    expect(saved.status).toBe(200);
    const stale = await agent
      .put(`/api/v1/admin/ocr-jobs/${jobId}/review`)
      .send({ draftVersion: job.body.draftVersion, draft });
    expect(stale.body.error.code).toBe('CONFLICT');

    const asm = await agent
      .post(`/api/v1/admin/ocr-jobs/${jobId}/assemble`)
      .send({ seriesKey: 'ocr-sample', title: 'OCR sample', source: 'CUSTOM', type: 'ACADEMIC' });
    expect(asm.status).toBe(200);
    expect(Array.isArray(asm.body.issues)).toBe(true);
  }, 60_000);

  it('rejects two PDFs or a PDF mixed with images', async () => {
    const agent = await admin();
    const pdf = Buffer.from('%PDF-1.4\n%%EOF');
    const res = await agent
      .post('/api/v1/admin/ocr-jobs')
      .attach('files', pdf, 'a.pdf')
      .attach('files', makeFerryChartPng(), 'b.png');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
