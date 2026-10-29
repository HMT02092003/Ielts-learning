import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { BACKEND_DIR, e2eDatabaseUrl } from './backend-env';

/**
 * Fresh e2e data without dropping anything: apply migrations, empty the (guarded) *_test database, then run
 * the normal idempotent seed. Never touches the dev database.
 */
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: e2eDatabaseUrl() };
  const prismaCli = path.join(BACKEND_DIR, 'node_modules', 'prisma', 'build', 'index.js');
  const run = (args: string[]) =>
    execFileSync(process.execPath, args, { cwd: BACKEND_DIR, env, stdio: 'pipe' });
  run([prismaCli, 'migrate', 'deploy']);
  run(['--import', 'tsx', 'prisma/seed/reset-test-db.ts']);
  run(['--import', 'tsx', 'prisma/seed/index.ts']);
}
