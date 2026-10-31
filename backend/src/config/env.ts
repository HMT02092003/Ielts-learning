import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/** backend/ directory (this file lives in backend/src/config). */
export const BACKEND_ROOT = path.resolve(import.meta.dirname, '..', '..');

// Fill only variables that are not already set (tests and CI set their own).
loadDotenv({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const int = (def: number, min = 0) => z.coerce.number().int().min(min).default(def);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: int(40000, 1),
  /** Browser origin(s) of the web app, comma-separated (dev :30000, `next start` :31000). */
  WEB_ORIGIN: z
    .string()
    .default('http://localhost:30000,http://localhost:31000')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET phải dài ít nhất 32 ký tự'),
  JWT_ISSUER: z.string().default('ielts-api'),
  JWT_AUDIENCE: z.string().default('ielts-web'),
  ACCESS_TOKEN_TTL_SECONDS: int(900, 60),
  REFRESH_TOKEN_TTL_DAYS: int(30, 1),
  REFRESH_FAMILY_MAX_DAYS: int(90, 1),
  REFRESH_ROTATION_GRACE_SECONDS: int(30),
  COOKIE_SECURE: bool.default(false),
  // OWASP minimums for argon2id: m ≥ 19 MiB, t ≥ 2.
  ARGON2_MEMORY_KIB: int(65536, 19456),
  ARGON2_TIME_COST: int(3, 2),
  ARGON2_PARALLELISM: int(4, 1),
  PASSWORD_MIN_LENGTH: int(8, 8),
  RATE_LIMIT_GLOBAL_PER_MIN: int(600, 1),

  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('../data/storage'),
  UPLOAD_TMP_DIR: z.string().default('../data/tmp'),
  UPLOAD_MAX_AUDIO_MB: int(100, 1),
  UPLOAD_MAX_IMAGE_MB: int(15, 1),
  UPLOAD_MAX_PDF_MB: int(50, 1),
  UPLOAD_MAX_RECORDING_MB: int(25, 1),
  UPLOAD_MAX_ZIP_MB: int(1024, 1),
  IMPORT_MAX_JSON_MB: int(5, 1),

  OCR_WORKER_ENABLED: bool.default(true),
  OCR_JOB_TIMEOUT_MS: int(600_000, 10_000),
  OCR_MAX_ATTEMPTS: int(3, 1),

  ATTEMPT_GRACE_SECONDS: int(30),
  /** Review time after the last Listening recording (computer-delivered IELTS: 2 min; check the official source). */
  LISTENING_REVIEW_SEC: int(120),
  ATTEMPT_SWEEP_INTERVAL_MS: int(30_000, 1000),

  LANGUAGETOOL_URL: z.url().default('http://127.0.0.1:8010'),
  LANGUAGETOOL_LANG: z.enum(['en-GB', 'en-US']).default('en-GB'),
  LANGUAGETOOL_TIMEOUT_MS: int(8000, 100),

  /** Free Dictionary API (dictionaryapi.dev, CC BY-SA content). Results cached in DictionaryCache. */
  DICTIONARY_URL: z.url().default('https://api.dictionaryapi.dev/api/v2/entries/en'),
  DICTIONARY_CACHE_DAYS: int(30, 1),
  DICTIONARY_TIMEOUT_MS: int(4000, 100),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ (backend/.env):\n${lines}`);
  }
  return result.data;
}

export const env = parseEnv();

/** Every WEB_ORIGIN plus its loopback twin (localhost ↔ 127.0.0.1, same port): both reach the same local app. */
export const allowedWebOrigins: readonly string[] = env.WEB_ORIGIN.flatMap((origin) => {
  const url = new URL(origin);
  const twin =
    url.hostname === 'localhost' ? '127.0.0.1' : url.hostname === '127.0.0.1' ? 'localhost' : undefined;
  return twin ? [url.origin, `${url.protocol}//${twin}${url.port ? `:${url.port}` : ''}`] : [url.origin];
});

/** Relative storage paths in .env resolve from backend/. */
export const resolveFromBackend = (p: string) => (path.isAbsolute(p) ? p : path.resolve(BACKEND_ROOT, p));
