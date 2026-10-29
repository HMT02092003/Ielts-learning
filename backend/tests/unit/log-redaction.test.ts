import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { REDACT_PATHS } from '../../src/config/logger';

describe('log redaction (spec §7: never log secrets)', () => {
  it('redacts cookies, auth headers, passwords and tokens', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      },
    });
    const log = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, sink);
    log.info({
      req: { headers: { cookie: 'ielts_at=secret-access', authorization: 'Bearer secret-bearer' } },
      res: { headers: { 'set-cookie': ['ielts_rt=secret-refresh'] } },
      body: { password: 'secret-password', newPassword: 'secret-new', refreshToken: 'secret-token' },
    });
    const out = lines.join('');
    expect(out).not.toMatch(/secret-/);
    expect(out).toContain('[REDACTED]');
  });
});
