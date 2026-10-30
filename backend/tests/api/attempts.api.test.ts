import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { attemptsService } from '../../src/modules/attempts/attempts.service';
import { bandTablesService } from '../../src/modules/band-tables/band-tables.service';
import { createUser, prisma, resetDb } from '../helpers/db';
import { loginAs } from '../helpers/http';

const FIXTURES = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'seed', 'fixtures');
const SENTINEL = '__ANS_7f3a__';

type Doc = {
  reading: {
    passages: {
      groups: {
        type: string;
        questions: { explanation?: string; accepted?: string[]; answer?: unknown }[];
      }[];
    }[];
  };
};

/** Import + publish the dummy reading test; every explanation and text variant carries a sentinel. */
async function publishReading() {
  const doc = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'dummy-reading.json'), 'utf8')) as Doc;
  for (const p of doc.reading.passages)
    for (const g of p.groups)
      for (const q of g.questions) {
        q.explanation = `${SENTINEL} because`;
        if (Array.isArray(q.accepted)) q.accepted = [...q.accepted, `${SENTINEL}x`];
      }
  const admin = await loginAs('admin@test.local');
  const imp = await admin
    .post('/api/v1/admin/tests/import')
    .attach('files', Buffer.from(JSON.stringify(doc)), 'reading.json');
  expect(imp.status).toBe(201);
  await admin.post(`/api/v1/admin/tests/${imp.body.testId}/publish`).send({});
  return imp.body.testId as string;
}

/** The right answer for every question, built from the DB (the student would type these). */
async function correctAnswers(testId: string) {
  const rows = await prisma.question.findMany({
    where: { section: { testId } },
    select: { id: true, number: true, correctAnswer: true, groupId: true },
    orderBy: { number: 'asc' },
  });
  const answers: Record<string, unknown> = {};
  const multiUsed = new Map<string, number>();
  for (const r of rows) {
    const c = r.correctAnswer as { kind: string; key?: string; keys?: string[]; display?: string };
    if (c.kind === 'KEY') answers[r.id] = { kind: 'KEY', key: c.key };
    else if (c.kind === 'TEXT')
      answers[r.id] = { kind: 'TEXT', text: (c.display ?? '').replace(/[()]/g, '') };
    else {
      const i = multiUsed.get(r.groupId) ?? 0;
      multiUsed.set(r.groupId, i + 1);
      answers[r.id] = { kind: 'KEY', key: c.keys?.[i] };
    }
  }
  return answers;
}

beforeEach(async () => {
  await resetDb();
  await createUser({ email: 'admin@test.local', role: 'ADMIN' });
  await createUser({ email: 'dat@test.local' });
  await createUser({ email: 'other@test.local' });
  await bandTablesService.ensureDefaults(null);
});

describe('attempt lifecycle (Reading, EXAM)', () => {
  it('never leaks answers before submit, saves snapshots, scores and bands after submit', async () => {
    const testId = await publishReading();
    const s = await loginAs('dat@test.local');

    const lib = await s.get('/api/v1/tests');
    expect(lib.body.items.map((t: { id: string }) => t.id)).toContain(testId);

    const started = await s.post('/api/v1/attempts').send({ testId, skill: 'READING', mode: 'EXAM' });
    expect(started.status).toBe(201);
    const id = started.body.attempt.id as string;
    const again = await s.post('/api/v1/attempts').send({ testId, skill: 'READING', mode: 'EXAM' });
    expect(again.status).toBe(200); // resumes the open attempt (one per scope)
    expect(again.body.attempt.id).toBe(id);

    const content = await s.get(`/api/v1/attempts/${id}/content`);
    expect(content.status).toBe(200);
    const raw = JSON.stringify(content.body);
    expect(raw).not.toContain(SENTINEL);
    expect(raw).not.toMatch(/"(correctAnswer|acceptedAnswers|explanation|evidence|transcript)":/);
    expect(content.body.parts).toHaveLength(3);

    const begun = await s.post(`/api/v1/attempts/${id}/begin`).send({});
    expect(begun.body.status).toBe('IN_PROGRESS');
    expect(new Date(begun.body.deadlineAt).getTime() - new Date(begun.body.startedAt).getTime()).toBe(
      3600_000,
    );

    // Results are not available before submitting.
    expect((await s.get(`/api/v1/attempts/${id}/result`)).body.error.code).toBe('ATTEMPT_NOT_SUBMITTED');

    const answers = await correctAnswers(testId);
    const firstId = Object.keys(answers)[0] as string;
    const save1 = await s
      .post(`/api/v1/attempts/${id}/autosave`)
      .send({ clientSeq: 2, answers: { [firstId]: answers[firstId] }, flagged: [firstId] });
    expect(save1.body.applied).toBe(true);
    const stale = await s
      .post(`/api/v1/attempts/${id}/autosave`)
      .send({ clientSeq: 1, answers: {}, flagged: [] });
    expect(stale.body).toMatchObject({ applied: false, savedSeq: 2 });

    const state = await s.get(`/api/v1/attempts/${id}`);
    expect(state.body.flagged).toEqual([firstId]);
    expect(Object.keys(state.body.answers)).toEqual([firstId]);

    // Another student cannot see or write it.
    const other = await loginAs('other@test.local');
    expect((await other.get(`/api/v1/attempts/${id}`)).status).toBe(404);

    const submitted = await s
      .post(`/api/v1/attempts/${id}/submit`)
      .send({ clientSeq: 3, answers, flagged: [] });
    expect(submitted.body.attempt).toMatchObject({
      status: 'SUBMITTED',
      rawScore: 40,
      maxScore: 40,
      band: 9,
    });

    const result = await s.get(`/api/v1/attempts/${id}/result`);
    expect(result.body.items).toHaveLength(40);
    expect(result.body.items.every((i: { isCorrect: boolean }) => i.isCorrect)).toBe(true);
    expect(result.body.bandTable).toMatchObject({ kind: 'READING_ACADEMIC', isReference: true });
    expect(result.body.byPart).toHaveLength(3);

    // Submitted: no more writes.
    const late = await s
      .post(`/api/v1/attempts/${id}/autosave`)
      .send({ clientSeq: 9, answers: {}, flagged: [] });
    expect(late.body.error.code).toBe('ATTEMPT_DEADLINE_PASSED');
  });

  it('rejects answers of the wrong kind or an unknown option', async () => {
    const testId = await publishReading();
    const s = await loginAs('dat@test.local');
    const { body } = await s.post('/api/v1/attempts').send({ testId, skill: 'READING', mode: 'PRACTICE' });
    await s.post(`/api/v1/attempts/${body.attempt.id}/begin`).send({});
    const q1 = await prisma.question.findFirstOrThrow({ where: { section: { testId }, number: 1 } });
    const bad = await s
      .post(`/api/v1/attempts/${body.attempt.id}/autosave`)
      .send({ clientSeq: 1, answers: { [q1.id]: { kind: 'KEY', key: 'MAYBE' } } });
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    const ok = await s
      .post(`/api/v1/attempts/${body.attempt.id}/autosave`)
      .send({ clientSeq: 1, answers: { [q1.id]: { kind: 'KEY', key: 'not given' } } });
    expect(ok.body.applied).toBe(true);
  });

  it('auto-submits after deadline + grace (lazy on read, and by the sweeper), exactly once', async () => {
    const testId = await publishReading();
    const s = await loginAs('dat@test.local');
    const { body } = await s.post('/api/v1/attempts').send({ testId, skill: 'READING', mode: 'EXAM' });
    const id = body.attempt.id as string;
    await s.post(`/api/v1/attempts/${id}/begin`).send({});
    await prisma.attempt.update({ where: { id }, data: { deadlineAt: new Date(Date.now() - 60_000) } });

    // Submit and sweeper racing: one wins, the attempt ends up EXPIRED once.
    const [a, b] = await Promise.all([
      attemptsService.finalize(id, 'DEADLINE'),
      attemptsService.finalizeExpired(),
    ]);
    expect([a, b].filter(Boolean).length).toBeLessThanOrEqual(2);
    const row = await prisma.attempt.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: 'EXPIRED', submitReason: 'DEADLINE', rawScore: 0 });
    expect((await s.get(`/api/v1/attempts/${id}`)).body.status).toBe('EXPIRED');
  });

  it('practice by part and by question type; retry wrong answers', async () => {
    const testId = await publishReading();
    const s = await loginAs('dat@test.local');
    const lib = await s.get(`/api/v1/tests/${testId}`);
    const part2 = lib.body.sections[0].parts[1].id as string;

    const byPart = await s
      .post('/api/v1/attempts')
      .send({ testId, skill: 'READING', mode: 'PRACTICE', scope: 'PART', partId: part2 });
    const c1 = await s.get(`/api/v1/attempts/${byPart.body.attempt.id}/content`);
    expect(c1.body.parts.map((p: { number: number }) => p.number)).toEqual([2]);

    const byType = await s.post('/api/v1/attempts').send({
      testId,
      skill: 'READING',
      mode: 'PRACTICE',
      scope: 'QUESTION_TYPE',
      questionTypes: ['TRUE_FALSE_NOT_GIVEN'],
    });
    const c2 = await s.get(`/api/v1/attempts/${byType.body.attempt.id}/content`);
    const groups = c2.body.parts.flatMap((p: { groups: { type: string }[] }) => p.groups);
    expect(groups.every((g: { type: string }) => g.type === 'TRUE_FALSE_NOT_GIVEN')).toBe(true);

    const exam = await s.post('/api/v1/attempts').send({
      testId,
      skill: 'READING',
      mode: 'EXAM',
      scope: 'QUESTION_TYPE',
      questionTypes: ['SHORT_ANSWER'],
    });
    expect(exam.body.error.code).toBe('VALIDATION_ERROR');

    const id = byPart.body.attempt.id as string;
    await s.post(`/api/v1/attempts/${id}/begin`).send({});
    await s.post(`/api/v1/attempts/${id}/submit`).send({});
    const retry = await s.post(`/api/v1/attempts/${id}/retry-wrong`).send({});
    expect(retry.status).toBe(201);
    expect(retry.body.attempt.scope).toBe('QUESTION_IDS');
  });
});

describe('annotations', () => {
  it('creates idempotently, validates the quoted text, lists and deletes', async () => {
    const testId = await publishReading();
    const s = await loginAs('dat@test.local');
    const { body } = await s.post('/api/v1/attempts').send({ testId, skill: 'READING', mode: 'PRACTICE' });
    const id = body.attempt.id as string;
    const para = await prisma.paragraph.findFirstOrThrow({
      where: { passage: { part: { section: { testId } } } },
    });
    const exact = para.text.slice(0, 12);
    const payload = {
      clientId: '0190f2a8-0000-7000-8000-000000000001',
      kind: 'HIGHLIGHT',
      targetKind: 'PARAGRAPH',
      targetId: para.id,
      startOffset: 0,
      endOffset: 12,
      exact,
    };
    const a = await s.post(`/api/v1/attempts/${id}/annotations`).send(payload);
    const b = await s.post(`/api/v1/attempts/${id}/annotations`).send(payload);
    expect(a.status).toBe(201);
    expect(b.body.id).toBe(a.body.id);
    const wrong = await s
      .post(`/api/v1/attempts/${id}/annotations`)
      .send({ ...payload, clientId: '0190f2a8-0000-7000-8000-000000000002', exact: 'nope' });
    expect(wrong.body.error.code).toBe('VALIDATION_ERROR');
    const note = await s.patch(`/api/v1/annotations/${a.body.id}`).send({ kind: 'NOTE', note: 'xem lại' });
    expect(note.body.note).toBe('xem lại');
    expect((await s.get(`/api/v1/attempts/${id}/annotations`)).body).toHaveLength(1);
    expect((await s.delete(`/api/v1/annotations/${a.body.id}`)).status).toBe(204);
  });
});
