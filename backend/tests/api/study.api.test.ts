import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bandTablesService } from '../../src/modules/band-tables/band-tables.service';
import { dictionaryService } from '../../src/modules/dictionary/dictionary.service';
import { createUser, prisma, resetDb } from '../helpers/db';
import { loginAs } from '../helpers/http';

const FIXTURES = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'seed', 'fixtures');

async function publishReading() {
  const doc = fs.readFileSync(path.join(FIXTURES, 'dummy-reading.json'));
  const admin = await loginAs('admin@test.local');
  const imp = await admin.post('/api/v1/admin/tests/import').attach('files', doc, 'reading.json');
  await admin.post(`/api/v1/admin/tests/${imp.body.testId}/publish`).send({});
  return imp.body.testId as string;
}

beforeEach(async () => {
  await resetDb();
  await createUser({ email: 'admin@test.local', role: 'ADMIN' });
  await createUser({ email: 'dat@test.local' });
  await createUser({ email: 'other@test.local' });
  await bandTablesService.ensureDefaults(null);
});

describe('vocabulary + flashcards', () => {
  it('saves a word from a passage (practice), reviews it idempotently, isolates users', async () => {
    const testId = await publishReading();
    const s = await loginAs('dat@test.local');
    const started = await s.post('/api/v1/attempts').send({ testId, skill: 'READING', mode: 'EXAM' });
    const attemptId = started.body.attempt.id as string;
    await s.post(`/api/v1/attempts/${attemptId}/begin`).send({});
    const content = await s.get(`/api/v1/attempts/${attemptId}/content`);
    const para = content.body.parts[0].passage.paragraphs[0] as { id: string; text: string };
    const word = 'relaxed';
    const start = para.text.indexOf(word);
    const source = { attemptId, paragraphId: para.id, start, end: start + word.length };

    // Not during an open EXAM attempt.
    expect((await s.post('/api/v1/vocabulary').send({ term: word, source })).status).toBe(409);
    await s.post(`/api/v1/attempts/${attemptId}/submit`).send({});

    const created = await s.post('/api/v1/vocabulary').send({ term: word, meaning: 'nới lỏng', source });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      term: 'relaxed',
      state: 'NEW',
      sourceTestTitle: 'Đề mẫu Reading (dummy)',
    });
    expect(created.body.exampleSentence).toContain('relaxed its building rules');
    expect((await s.post('/api/v1/vocabulary').send({ term: ' Relaxed ' })).status).toBe(409);

    const q = await s.get('/api/v1/vocabulary/review-queue');
    expect(q.body.cards).toHaveLength(1);
    expect(q.body.cards[0].preview).toEqual({
      AGAIN: '<1 phút',
      HARD: '6 phút',
      GOOD: '1 ngày',
      EASY: '4 ngày',
    });

    const clientReviewId = randomUUID();
    const r1 = await s
      .post(`/api/v1/vocabulary/${created.body.id}/review`)
      .send({ grade: 'GOOD', clientReviewId });
    expect(r1.body).toMatchObject({ state: 'REVIEW', intervalDays: 1 });
    const again = await s
      .post(`/api/v1/vocabulary/${created.body.id}/review`)
      .send({ grade: 'GOOD', clientReviewId });
    expect(again.body.intervalDays).toBe(1);
    expect(await prisma.vocabularyReview.count()).toBe(1);
    expect((await s.get('/api/v1/vocabulary/review-queue')).body.cards).toHaveLength(0);

    const o = await loginAs('other@test.local');
    expect((await o.patch(`/api/v1/vocabulary/${created.body.id}`).send({ meaning: 'x' })).status).toBe(404);
    expect((await o.get('/api/v1/vocabulary')).body.total).toBe(0);
  });
});

describe('stats', () => {
  it('dashboard, radar, heatmap and band trend after a scored Reading attempt; marks override "done"', async () => {
    const testId = await publishReading();
    const s = await loginAs('dat@test.local');
    const started = await s.post('/api/v1/attempts').send({ testId, skill: 'READING', mode: 'PRACTICE' });
    const id = started.body.attempt.id as string;
    await s.post(`/api/v1/attempts/${id}/begin`).send({});
    await s.post(`/api/v1/attempts/${id}/submit`).send({});

    const d = await s.get('/api/v1/stats/dashboard');
    expect(d.status).toBe(200);
    const reading = d.body.bandBySkill.find((b: { skill: string }) => b.skill === 'READING');
    expect(reading).toMatchObject({ attempts: 1 });
    expect(reading.band).not.toBeNull();
    expect(d.body.overallBand).toBeNull(); // W/S have no human grade yet (M9)
    expect(d.body.streak.current).toBe(1); // a submitted attempt counts for today
    expect(d.body.weakTypes.length).toBeGreaterThan(0); // everything blank → every type is weak

    const stat = await prisma.studyStat.findFirst({ where: { user: { email: 'dat@test.local' } } });
    expect(stat?.attemptsSubmitted).toBe(1);

    const heat = await s.get('/api/v1/stats/heatmap?days=7');
    expect(heat.body.days).toHaveLength(7);
    const trend = await s.get('/api/v1/stats/band-trend?skill=READING&range=all');
    expect(trend.body.points).toHaveLength(1);
    expect((await s.get('/api/v1/stats/radar')).body.skills).toHaveLength(4);

    const lib1 = await s.get('/api/v1/tests');
    const card = lib1.body.items.find((t: { id: string }) => t.id === testId);
    expect(card.done).toBe(true); // every section of this test has a whole-section attempt
    const mark = await s.put(`/api/v1/me/tests/${card.seriesKey}/mark`).send({ hidden: true });
    expect(mark.body).toMatchObject({ hidden: true, done: false });
  });
});

describe('dictionary', () => {
  it('caches hits and misses; maps upstream failures', async () => {
    let calls = 0;
    const ok = (() => {
      calls += 1;
      return Promise.resolve(
        new Response(
          JSON.stringify([
            {
              word: 'resilient',
              phonetic: '/rɪˈzɪliənt/',
              meanings: [
                { partOfSpeech: 'adjective', definitions: [{ definition: 'Able to recover quickly.' }] },
              ],
              license: { name: 'CC BY-SA 3.0' },
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }) as typeof fetch;
    const e1 = await dictionaryService.lookup('Resilient', ok);
    expect(e1).toMatchObject({ term: 'resilient', cached: false, license: 'CC BY-SA 3.0' });
    const e2 = await dictionaryService.lookup('resilient', ok);
    expect(e2.cached).toBe(true);
    expect(calls).toBe(1);

    const missing = (() => Promise.resolve(new Response('{}', { status: 404 }))) as typeof fetch;
    await expect(dictionaryService.lookup('qwzx', missing)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(dictionaryService.lookup('qwzx', ok)).rejects.toMatchObject({ code: 'NOT_FOUND' }); // cached miss

    const down = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    await expect(dictionaryService.lookup('other', down)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
  });
});
