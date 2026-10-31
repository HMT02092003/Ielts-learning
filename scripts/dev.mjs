// npm run dev — one command for local development:
//   PostgreSQL on this machine (port 5432) → migrate + seed (idempotent) → LanguageTool :8010 (from .tools/),
//   backend :40000 and frontend :30000 together. Ctrl+C stops all three.
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

console.log('▶ PostgreSQL trên máy (127.0.0.1:5432)');
if (!(await portBusy(5432))) {
  console.error('\nPostgreSQL chưa chạy. Mở services.msc → bật dịch vụ "postgresql-x64-17", rồi chạy lại npm run dev.');
  process.exit(1);
}

console.log('\n▶ Database: migrate + seed');
await run(`${YARN} run db:setup`, BACKEND);

const children = [];
// LanguageTool (Writing estimate) runs from .tools/ — a portable JRE + the LanguageTool server zip.
const java = path.join(ROOT, '.tools', 'jre', 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
const ltDir = path.join(ROOT, '.tools', 'languagetool');
if (await portBusy(8010)) {
  console.log('\n• LanguageTool đã chạy sẵn ở cổng 8010');
} else if (existsSync(java) && existsSync(path.join(ltDir, 'languagetool-server.jar'))) {
  children.push(
    startPrefixed(
      'lt',
      '33',
      `"${java}" -Xms256m -Xmx1g -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8010`,
      ltDir,
    ),
  );
} else {
  console.log('\n• Không thấy .tools/languagetool — phần ước lượng Writing sẽ không chạy (xem README).');
}

console.log('\n▶ Chạy backend (:40000) và frontend (:30000) — Ctrl+C để dừng\n');
children.push(
  startPrefixed('api', '36', `${YARN} run dev`, BACKEND),
  startPrefixed('web', '35', `${YARN} run dev`, FRONTEND),
);

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
