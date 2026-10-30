import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, prisma, resetDb } from '../helpers/db';
import { loginAs } from '../helpers/http';

const FIXTURES = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'seed', 'fixtures');

async function publish(file: string, mutate?: (doc: Record<string, unknown>) => void) {
  const doc = JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8')) as Record<string, unknown>;
  mutate?.(doc);
  const admin = await loginAs('admin@test.local');
  const imp = await admin
    .post('/api/v1/admin/tests/import')
    .attach('files', Buffer.from(JSON.stringify(doc)), 'doc.json');
  expect(imp.status, JSON.stringify(imp.body)).toBe(201);
  const pub = await admin.post(`/api/v1/admin/tests/${imp.body.testId}/publish`).send({});
  expect(pub.status, JSON.stringify(pub.body)).toBe(200);
  return imp.body.testId as string;
}

/** Minimal valid PCM WAV (RIFF/WAVE magic bytes) — 0.1 s of silence. */
function wav(): Buffer {
  const samples = 800;
  const b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples * 2, 40);
  return b;
}

const ESSAY = `Some people believe that city centres should be closed to private cars. However, others argue that this would harm local businesses, which depend on customers who drive.

On the one hand, closing centres to cars reduces pollution and noise. For example, streets become safer for children, and cyclists can travel without fear. Moreover, shops may benefit because pedestrians tend to stop more often than drivers.

On the other hand, people who live far away may find it difficult to reach the centre. Although public transport exists, it is not always reliable, so some customers could choose out-of-town shopping centres instead.

In conclusion, I believe that cities should limit cars gradually while improving buses and trams, because this balances clean air with the needs of businesses.`;

beforeEach(async () => {
  await resetDb();
  await createUser({ email: 'admin@test.local', role: 'ADMIN' });
  await createUser({ email: 'dat@test.local' });
  await createUser({ email: 'other@test.local' });
});

describe('Writing', () => {
  it('autosaves per task with CAS, locks on submit, queues an estimate and accepts a human review', async () => {
    const testId = await publish('dummy-writing.json', (doc) => {
      const tasks = (doc.writing as { tasks: Record<string, unknown>[] }).tasks;
      for (const t of tasks) delete t.image;
    });
    const s = await loginAs('dat@test.local');
    const started = await s.post('/api/v1/attempts').send({ testId, skill: 'WRITING', mode: 'PRACTICE' });
    expect(started.status).toBe(201);
    const id = started.body.attempt.id as string;
    await s.post(`/api/v1/attempts/${id}/begin`).send({});

    const list = await s.get(`/api/v1/attempts/${id}/writing`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    const task2 = list.body.find((x: { partNumber: number }) => x.partNumber === 2);

    const save = await s
      .put(`/api/v1/attempts/${id}/writing/${task2.partId}`)
      .send({ clientSeq: 2, text: ESSAY });
    expect(save.body).toMatchObject({ applied: true, savedSeq: 2 });
    expect(save.body.wordCount).toBeGreaterThan(100);
    const stale = await s
      .put(`/api/v1/attempts/${id}/writing/${task2.partId}`)
      .send({ clientSeq: 1, text: 'old' });
    expect(stale.body.applied).toBe(false);

    // Someone else cannot read or write it.
    const o = await loginAs('other@test.local');
    expect((await o.get(`/api/v1/attempts/${id}/writing`)).status).toBe(404);

    expect((await s.post(`/api/v1/attempts/${id}/submit`).send({})).status).toBe(200);
    const late = await s
      .put(`/api/v1/attempts/${id}/writing/${task2.partId}`)
      .send({ clientSeq: 3, text: 'x' });
    expect(late.status).toBe(409);

    // The estimate runs in the background (LanguageTool may be absent → degraded, still DONE).
    let sub:
      | {
          status: string;
          text: string;
          evaluations: { status: string; isEstimate: boolean; result: unknown }[];
        }
      | undefined;
    for (let i = 0; i < 60; i++) {
      sub = (await s.get(`/api/v1/writing-submissions/${task2.id}`)).body;
      if (sub?.evaluations[0]?.status === 'DONE' || sub?.evaluations[0]?.status === 'FAILED') break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(sub?.status).toBe('SUBMITTED');
    expect(sub?.text).toBe(ESSAY);
    expect(sub?.evaluations[0]).toMatchObject({ status: 'DONE', isEstimate: true });
    expect(sub?.evaluations[0]?.result).toMatchObject({
      disclaimer: 'ƯỚC LƯỢNG, không thay thế giám khảo',
      criteria: { taskResponse: { band: null }, coherence: { band: null } },
    });

    // Admin queue → human review (mean of four criteria).
    const admin = await loginAs('admin@test.local');
    const queue = await admin.get('/api/v1/admin/grading?kind=WRITING');
    expect(queue.body.items.map((x: { id: string }) => x.id)).toContain(task2.id);
    const review = await admin
      .post(`/api/v1/admin/grading/writing/${task2.id}/reviews`)
      .send({ bandTaskResponse: 6, bandCoherence: 6.5, bandLexical: 6, bandGrammar: 6.5, comment: 'Tốt' });
    expect(review.status).toBe(201);
    expect(review.body.evaluations.at(-1)).toMatchObject({
      evaluator: 'HUMAN',
      isEstimate: false,
      bandOverall: 6.5,
    });
    expect((await s.post(`/api/v1/admin/grading/writing/${task2.id}/reviews`).send({})).status).toBe(404);

    const mine = await s.get('/api/v1/writing-submissions');
    expect(mine.body.total).toBe(2);
  });
});

describe('Speaking', () => {
  it('uploads recordings (magic bytes checked), serves them to the owner only, admin reviews', async () => {
    const testId = await publish('dummy-speaking.json');
    const s = await loginAs('dat@test.local');
    const started = await s.post('/api/v1/attempts').send({ testId, skill: 'SPEAKING', mode: 'PRACTICE' });
    const id = started.body.attempt.id as string;
    await s.post(`/api/v1/attempts/${id}/begin`).send({});
    const content = await s.get(`/api/v1/attempts/${id}/content`);
    const partId = content.body.parts[0].id as string;

    const bad = await s
      .post(`/api/v1/attempts/${id}/speaking/recordings`)
      .field('partId', partId)
      .attach('audio', Buffer.from('not audio at all'), 'x.webm');
    expect(bad.status).toBe(415);

    const ok = await s
      .post(`/api/v1/attempts/${id}/speaking/recordings`)
      .field('partId', partId)
      .field('durationMs', '100')
      .attach('audio', wav(), 'take.wav');
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.recordings).toHaveLength(1);
    const rec = ok.body.recordings[0];
    expect(rec).toMatchObject({ partNumber: 1, take: 1, mimeType: 'audio/wav' });

    expect((await s.get(`/api/v1/files/${rec.fileId}`)).status).toBe(200);
    const o = await loginAs('other@test.local');
    expect((await o.get(`/api/v1/files/${rec.fileId}`)).status).toBe(404);

    await s.post(`/api/v1/attempts/${id}/submit`).send({});
    const admin = await loginAs('admin@test.local');
    const q = await admin.get('/api/v1/admin/grading?kind=SPEAKING');
    expect(q.body.items[0]).toMatchObject({ attemptId: id, reviewed: false });
    const r = await admin
      .post(`/api/v1/admin/grading/speaking/${id}/reviews`)
      .send({ bandFluency: 6, bandLexical: 6, bandGrammar: 5.5, bandPronunciation: 6, comment: 'Ổn' });
    expect(r.status).toBe(201);
    expect(r.body.evaluations[0]).toMatchObject({ bandOverall: 6, reviewerName: expect.any(String) });
    expect(await prisma.speakingEvaluation.count()).toBe(1);
  });
});
