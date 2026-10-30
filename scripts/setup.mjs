// npm run setup — first run on a new machine:
//   1. create .env, backend/.env, frontend/.env.local from the examples (never overwrites existing files),
//      with one freshly generated JWT secret shared by host mode and Docker mode;
//   2. install the dependencies of backend/ and frontend/ (Yarn 1).
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BACKEND, FRONTEND, YARN, ROOT, run } from './lib.mjs';

const secret = randomBytes(48).toString('base64url');
const files = [
  [path.join(ROOT, '.env.example'), path.join(ROOT, '.env')],
  [path.join(BACKEND, '.env.example'), path.join(BACKEND, '.env')],
  [path.join(FRONTEND, '.env.example'), path.join(FRONTEND, '.env.local')],
];

for (const [example, target] of files) {
  const rel = path.relative(ROOT, target);
  if (existsSync(target)) {
    console.log(`• ${rel} đã có — giữ nguyên`);
    continue;
  }
  const body = readFileSync(example, 'utf8').replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret}`);
  writeFileSync(target, body);
  console.log(`• đã tạo ${rel}`);
}

console.log('\nCài thư viện backend…');
await run(`${YARN} install --frozen-lockfile`, BACKEND);
console.log('\nCài thư viện frontend…');
await run(`${YARN} install --frozen-lockfile`, FRONTEND);

console.log(`
Xong. Tiếp theo:
  • Chạy trên máy (dev):      npm run dev        → http://localhost:30000
  • Hoặc toàn bộ bằng Docker: npm run docker:up  → http://localhost:31000
Tài khoản đăng nhập: xem SEED_ADMIN_* / SEED_STUDENT_* trong backend/.env (nên đổi mật khẩu mẫu).`);
