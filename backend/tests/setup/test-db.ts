import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

const BACKEND_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** Loads backend/.env and points DATABASE_URL at the test database. Refuses anything not named *_test. */
export function useTestDatabase(): string {
  loadDotenv({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL chưa được đặt trong backend/.env');
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Từ chối chạy test trên database "${dbName}" (tên phải kết thúc bằng _test)`);
  }
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  return url;
}

export { BACKEND_ROOT };
