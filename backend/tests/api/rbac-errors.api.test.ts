import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDb } from '../helpers/db';
import { app, loginAs } from '../helpers/http';

beforeEach(async () => {
  await resetDb();
});

describe('role-based access', () => {
  it('admin can reach admin routes', async () => {
    await createUser({ email: 'admin@test.local', role: 'ADMIN' });
    const agent = await loginAs('admin@test.local');
    const res = await agent.get('/api/v1/admin/overview');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ users: 1, activeUsers: 1 });
  });

  it('a student gets 404 (admin routes are not revealed)', async () => {
    await createUser({ email: 'dat@test.local' });
    const agent = await loginAs('dat@test.local');
    const res = await agent.get('/api/v1/admin/overview');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('anonymous requests get 401', async () => {
    const res = await request(app).get('/api/v1/admin/overview');
    expect(res.status).toBe(401);
  });
});

describe('uniform error shape', () => {
  it('unknown route → 404 { error: { code, message } }', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('malformed JSON → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('unknown body keys are rejected (strict input)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.cd', password: 'x', role: 'ADMIN' });
    expect(res.status).toBe(400);
  });

  it('cross-site state-changing requests are blocked by the origin guard', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', 'https://evil.example')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('every response carries a request id and security headers', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
