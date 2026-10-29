import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const BACKEND_ROOT = path.resolve(import.meta.dirname, '..');
export const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');

function readEnvFile(file) {
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
}

/** POSTGRES_* from the root .env used by docker compose (defaults match docker-compose.yml). */
export function readComposeEnv() {
  const e = readEnvFile(path.join(REPO_ROOT, '.env'));
  return {
    POSTGRES_USER: e.POSTGRES_USER ?? 'ielts',
    POSTGRES_DB: e.POSTGRES_DB ?? 'ielts',
  };
}

const backendEnv = readEnvFile(path.join(BACKEND_ROOT, '.env'));
export const STORAGE_DIR = path.resolve(BACKEND_ROOT, backendEnv.STORAGE_LOCAL_ROOT ?? '../data/storage');
