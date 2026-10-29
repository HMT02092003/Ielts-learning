import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const BACKEND_DIR = path.resolve(import.meta.dirname, '..', '..', 'backend');

/** backend/.env values (E2E_DATABASE_URL, seed accounts). */
export function backendEnv(): Record<string, string | undefined> {
  const file = path.join(BACKEND_DIR, '.env');
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
}

/** The e2e database URL; refuses anything whose name does not end with _test. */
export function e2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL ?? backendEnv().E2E_DATABASE_URL;
  if (!url) throw new Error('E2E_DATABASE_URL chưa được đặt trong backend/.env');
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) throw new Error(`Từ chối chạy e2e trên database "${name}"`);
  return url;
}
