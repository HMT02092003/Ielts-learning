import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const BACKEND_ROOT = path.resolve(import.meta.dirname, '..');
export const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');

function readEnvFile(file) {
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
}

const backendEnv = readEnvFile(path.join(BACKEND_ROOT, '.env'));
export const STORAGE_DIR = path.resolve(BACKEND_ROOT, backendEnv.STORAGE_LOCAL_ROOT ?? '../data/storage');

/** The app database (DATABASE_URL in backend/.env), passed to pg_dump/pg_restore as a connection URI. */
export function readDatabase() {
  if (!backendEnv.DATABASE_URL) throw new Error('Thiếu DATABASE_URL trong backend/.env');
  return { url: backendEnv.DATABASE_URL, name: new URL(backendEnv.DATABASE_URL).pathname.slice(1) };
}

/** A PostgreSQL client tool: PG_BIN (backend/.env), else the default PostgreSQL 17 install on Windows, else PATH. */
export function pgTool(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  for (const dir of [backendEnv.PG_BIN, 'C:\\Program Files\\PostgreSQL\\17\\bin']) {
    if (dir && existsSync(path.join(dir, exe))) return path.join(dir, exe);
  }
  return name;
}
