import request from 'supertest';
import { createApp } from '../../src/app';
import { TEST_PASSWORD } from './db';

export const app = createApp();

/** A cookie-keeping client, already logged in. */
export async function loginAs(email: string, password = TEST_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200)
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

/** Set-Cookie headers as an array (supertest types it loosely). */
export function setCookies(res: request.Response): string[] {
  const raw: unknown = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : [];
}

export function cookieValue(res: request.Response, name: string): string | undefined {
  const line = setCookies(res).find((c) => c.startsWith(`${name}=`));
  return line?.split(';')[0]?.slice(name.length + 1);
}
