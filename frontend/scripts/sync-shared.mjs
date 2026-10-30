// Copies the shared Zod contracts from backend/src/shared (single source of truth) into frontend/src/shared.
//   node scripts/sync-shared.mjs          → copy
//   node scripts/sync-shared.mjs --check  → exit 1 if the copy is out of date (used by `yarn run check` / CI)
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND = path.resolve(import.meta.dirname, '..');
const SRC = path.resolve(FRONTEND, '..', 'backend', 'src', 'shared');
const DEST = path.join(FRONTEND, 'src', 'shared');
const HEADER = '// GENERATED from backend/src/shared by scripts/sync-shared.mjs — DO NOT EDIT.\n';

const check = process.argv.includes('--check');
const expected = new Map(
  fs
    .readdirSync(SRC)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => [f, HEADER + fs.readFileSync(path.join(SRC, f), 'utf8')]),
);

if (check) {
  const actual = fs.existsSync(DEST) ? fs.readdirSync(DEST).filter((f) => f.endsWith('.ts')) : [];
  const stale = [
    ...[...expected]
      .filter(([f, body]) => !actual.includes(f) || fs.readFileSync(path.join(DEST, f), 'utf8') !== body)
      .map(([f]) => f),
    ...actual.filter((f) => !expected.has(f)),
  ];
  if (stale.length > 0) {
    console.error(
      `src/shared lệch so với backend/src/shared: ${stale.join(', ')}\nChạy: yarn run sync-shared`,
    );
    process.exit(1);
  }
  console.log('src/shared khớp backend/src/shared.');
} else {
  fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });
  for (const [f, body] of expected) fs.writeFileSync(path.join(DEST, f), body);
  console.log(`Đã chép ${expected.size} file vào src/shared.`);
}
