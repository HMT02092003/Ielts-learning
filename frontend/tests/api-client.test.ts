import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api-client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const expired = () => json(401, { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'expired' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api()', () => {
  it('parses the response with the given schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, { n: 1 })),
    );
    await expect(api('/x', { schema: z.object({ n: z.number() }) })).resolves.toEqual({ n: 1 });
  });

  it('turns the uniform error body into ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(404, { error: { code: 'NOT_FOUND', message: 'Không có' } })),
    );
    const err = await api('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Không có' });
  });

  it('refreshes once (single-flight) for concurrent expired requests, then retries each', async () => {
    let refreshed = false;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/v1/auth/refresh') {
        refreshed = true;
        return json(200, {});
      }
      return refreshed ? json(200, { ok: true }) : expired();
    });
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([api('/a'), api('/b'), api('/c')]);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => u === '/api/v1/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
  });

  it('reports a session error when refresh fails (so the UI goes to /login)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/v1/auth/refresh'
          ? json(401, { error: { code: 'AUTH_REFRESH_INVALID', message: 'x' } })
          : expired(),
      ),
    );
    await expect(api('/a')).rejects.toMatchObject({ code: 'AUTH_REFRESH_INVALID' });
  });

  it('also refreshes for /auth/me (only login/refresh/logout are excluded)', async () => {
    let refreshed = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/v1/auth/refresh') {
          refreshed = true;
          return json(200, {});
        }
        return refreshed ? json(200, { id: 'me' }) : expired();
      }),
    );
    await expect(api('/auth/me')).resolves.toEqual({ id: 'me' });
  });

  it('flags responses that do not match the contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, { n: 'not-a-number' })),
    );
    await expect(api('/x', { schema: z.object({ n: z.number() }) })).rejects.toMatchObject({
      code: 'CONTRACT_MISMATCH',
    });
  });
});
