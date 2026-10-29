import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../../src/lib/cookies';
import { createUser, prisma, resetDb, TEST_PASSWORD } from '../helpers/db';
import { app, cookieValue, loginAs, setCookies } from '../helpers/http';

beforeEach(async () => {
  await resetDb();
});

describe('POST /api/v1/auth/login', () => {
  it('logs in, returns the user and sets httpOnly session cookies', async () => {
    await createUser({ email: 'dat@test.local' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'DAT@test.local ', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'dat@test.local', role: 'STUDENT' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookies = setCookies(res);
    const access = cookies.find((c) => c.startsWith(`${ACCESS_COOKIE}=`));
    const refresh = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Lax/);
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/SameSite=Strict/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    // Not "remembered" → session cookies (no Max-Age).
    expect(access).not.toMatch(/Max-Age/);
  });

  it('"remember" gives persistent cookies', async () => {
    await createUser({ email: 'dat@test.local' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dat@test.local', password: TEST_PASSWORD, remember: true });
    expect(setCookies(res).every((c) => /Max-Age=\d+/.test(c))).toBe(true);
  });

  it('rejects a wrong password and an unknown email with the same error', async () => {
    await createUser({ email: 'dat@test.local' });
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dat@test.local', password: 'wrong-password' });
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.local', password: 'wrong-password' });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { code: 'AUTH_INVALID_CREDENTIALS', message: expect.any(String) } });
    }
  });

  it('rejects a deactivated account only after a correct password', async () => {
    await createUser({ email: 'old@test.local', isActive: false });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'old@test.local', password: TEST_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_ACCOUNT_DISABLED');
  });

  it('validates the body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues.map((i: { path: string }) => i.path)).toEqual([
      'body.email',
      'body.password',
    ]);
  });
});

describe('session lifecycle', () => {
  it('GET /me requires a session', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /me returns the current user', async () => {
    await createUser({ email: 'dat@test.local' });
    const agent = await loginAs('dat@test.local');
    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('dat@test.local');
  });

  it('refresh rotates the refresh token; the old one still works within the grace window', async () => {
    await createUser({ email: 'dat@test.local' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dat@test.local', password: TEST_PASSWORD });
    const first = cookieValue(login, REFRESH_COOKIE);
    expect(first).toBeTruthy();

    const r1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${first}`)
      .send({});
    expect(r1.status).toBe(200);
    const second = cookieValue(r1, REFRESH_COOKIE);
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);

    // Second tab refreshing with the same (now rotated) token within 30 s → gets a sibling token.
    const r2 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${first}`)
      .send({});
    expect(r2.status).toBe(200);
  });

  it('refresh fails once the rotated token is older than the grace window', async () => {
    await createUser({ email: 'dat@test.local' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dat@test.local', password: TEST_PASSWORD });
    const first = cookieValue(login, REFRESH_COOKIE);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', `${REFRESH_COOKIE}=${first}`).send({});
    await prisma.refreshToken.updateMany({
      where: { rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - 60_000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${first}`)
      .send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REFRESH_INVALID');
    // Failed refresh clears both cookies so the client goes back to /login (no redirect loop).
    expect(setCookies(res).filter((c) => /Expires=Thu, 01 Jan 1970/.test(c))).toHaveLength(2);
  });

  it('logout revokes the refresh token family', async () => {
    await createUser({ email: 'dat@test.local' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dat@test.local', password: TEST_PASSWORD });
    const token = cookieValue(login, REFRESH_COOKIE);
    const out = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `${REFRESH_COOKIE}=${token}`)
      .send({});
    expect(out.status).toBe(204);
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${token}`)
      .send({});
    expect(res.status).toBe(401);
  });

  it('a deactivated user loses access immediately', async () => {
    const user = await createUser({ email: 'dat@test.local' });
    const agent = await loginAs('dat@test.local');
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('profile', () => {
  it('PATCH /me updates target band, exam date and preferences', async () => {
    await createUser({ email: 'dat@test.local' });
    const agent = await loginAs('dat@test.local');
    const res = await agent
      .patch('/api/v1/auth/me')
      .send({ targetBand: 7.5, examDate: '2026-12-15', preferences: { theme: 'dark' } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      targetBand: 7.5,
      examDate: '2026-12-15',
      preferences: { theme: 'dark', examFontSize: 'md' },
    });
  });

  it('rejects a band that is not a multiple of 0.5', async () => {
    await createUser({ email: 'dat@test.local' });
    const agent = await loginAs('dat@test.local');
    const res = await agent.patch('/api/v1/auth/me').send({ targetBand: 7.3 });
    expect(res.status).toBe(400);
  });

  it('change-password keeps the current session and revokes others', async () => {
    await createUser({ email: 'dat@test.local' });
    const other = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dat@test.local', password: TEST_PASSWORD });
    const otherRefresh = cookieValue(other, REFRESH_COOKIE);
    const agent = await loginAs('dat@test.local');

    const res = await agent
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'a-brand-new-password' });
    expect(res.status).toBe(204);

    const revoked = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${otherRefresh}`)
      .send({});
    expect(revoked.status).toBe(401);
    const relogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dat@test.local', password: 'a-brand-new-password' });
    expect(relogin.status).toBe(200);
  });
});
