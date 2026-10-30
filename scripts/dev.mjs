// npm run dev — one command for local development:
//   Docker (Postgres + LanguageTool) → migrate + seed (idempotent) → backend :40000 and frontend :30000 together.
//   Ctrl+C stops both apps (the Docker containers keep running; `docker compose down` stops them).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { BACKEND, FRONTEND, YARN, ROOT, killTree, portBusy, run, startPrefixed } from './lib.mjs';

const needsSetup = [
  path.join(ROOT, '.env'),
  path.join(BACKEND, '.env'),
  path.join(FRONTEND, '.env.local'),
  path.join(BACKEND, 'node_modules'),
  path.join(FRONTEND, 'node_modules'),
].some((p) => !existsSync(p));
if (needsSetup) {
  console.log('Chưa setup — chạy npm run setup trước…\n');
  await run('node scripts/setup.mjs');
}

for (const port of [30000, 40000]) {
  if (await portBusy(port)) {
    console.error(
      `Cổng ${port} đang bị dùng. Có thể app đang chạy ở terminal khác hoặc bằng Docker (npm run docker:down).`,
    );
    process.exit(1);
  }
}

console.log('▶ Docker: Postgres + LanguageTool');
try {
  await run('docker compose up -d --wait postgres');
  await run('docker compose up -d languagetool');
} catch {
  console.error('\nKhông gọi được Docker. Mở Docker Desktop (hoặc khởi động Docker Engine) rồi chạy lại npm run dev.');
  process.exit(1);
}

console.log('\n▶ Database: migrate + seed');
await run(`${YARN} run db:setup`, BACKEND);

console.log('\n▶ Chạy backend (:40000) và frontend (:30000) — Ctrl+C để dừng\n');
const children = [
  startPrefixed('api', '36', `${YARN} run dev`, BACKEND),
  startPrefixed('web', '35', `${YARN} run dev`, FRONTEND),
];

let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  children.forEach(killTree); // synchronous on Windows
  if (process.platform === 'win32') process.exit(code);
  setTimeout(() => process.exit(code), 1500); // POSIX: let children handle SIGINT
};
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
for (const child of children) {
  child.on('close', (code) => {
    if (!stopping) {
      console.error(`\nMột tiến trình đã dừng (mã ${code}). Tắt nốt tiến trình còn lại.`);
      stop(code ?? 1);
    }
  });
}
