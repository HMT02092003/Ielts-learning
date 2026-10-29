import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { storage } from '../../lib/storage';

type CheckStatus = 'ok' | 'down';

export interface Readiness {
  status: 'ok' | 'degraded' | 'down';
  checks: { db: CheckStatus; storage: CheckStatus; languagetool: CheckStatus };
}

async function probe(fn: () => Promise<unknown>): Promise<CheckStatus> {
  try {
    await fn();
    return 'ok';
  } catch {
    return 'down';
  }
}

export const healthService = {
  liveness() {
    return { status: 'ok' as const, uptimeSec: Math.round(process.uptime()) };
  },

  /** db/storage down → "down" (503); LanguageTool only matters for Writing evaluation → "degraded". */
  async readiness(): Promise<Readiness> {
    const [db, store, languagetool] = await Promise.all([
      probe(() => prisma.$queryRaw`SELECT 1`),
      probe(() => storage.check()),
      probe(async () => {
        const res = await fetch(`${env.LANGUAGETOOL_URL}/v2/languages`, {
          signal: AbortSignal.timeout(2000),
        });
        if (!res.ok) throw new Error(`LanguageTool HTTP ${res.status}`);
      }),
    ]);
    const status = db === 'down' || store === 'down' ? 'down' : languagetool === 'down' ? 'degraded' : 'ok';
    return { status, checks: { db, storage: store, languagetool } };
  },
};
