import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { BACKEND_ROOT, useTestDatabase } from './test-db';

/** Runs once before the suite: bring the *_test database to the latest migration. */
export default function setup() {
  useTestDatabase();
  // Call the CLI through the current node binary (no .cmd shims → works the same on Windows and Linux).
  execFileSync(
    process.execPath,
    [path.join(BACKEND_ROOT, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
    {
      cwd: BACKEND_ROOT,
      env: process.env,
      stdio: 'pipe',
    },
  );
}
