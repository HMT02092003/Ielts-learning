import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { e2eDatabaseUrl } from './e2e/backend-env';

// E2E runs its own backend (port 4100, database ielts_e2e_test) and web app (port 3100), so it never touches
// the dev database. The backend reads everything else from backend/.env.
const BACKEND = path.resolve(import.meta.dirname, '..', 'backend');
const API_PORT = 4100;
const WEB_PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    locale: 'vi-VN',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: 'node --import tsx src/server.ts',
      cwd: BACKEND,
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        API_PORT: String(API_PORT),
        WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
        DATABASE_URL: e2eDatabaseUrl(),
        RATE_LIMIT_LOGIN_PER_15MIN: '1000',
      },
    },
    {
      command: `node node_modules/next/dist/bin/next dev --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { API_ORIGIN: `http://127.0.0.1:${API_PORT}`, NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
});
