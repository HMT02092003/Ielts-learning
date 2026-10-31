// yarn run restore [<backup-folder-name>] [--yes]
// Restores the database (pg_restore --clean --if-exists) and data/storage from data/backups/<name>.
// Without a name, the most recent backup is used. Asks for confirmation unless --yes is given.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pipeline } from 'node:stream/promises';
import { pgTool, readDatabase, REPO_ROOT, STORAGE_DIR } from './common.mjs';

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const backupsRoot = path.join(REPO_ROOT, 'data', 'backups');
const names = existsSync(backupsRoot) ? (await fs.readdir(backupsRoot)).sort() : [];
const name = args.find((a) => !a.startsWith('--')) ?? names.at(-1);
if (!name) {
  console.error('Không có bản sao lưu nào trong data/backups.');
  process.exit(1);
}
const dir = path.join(backupsRoot, name);
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));

const hash = createHash('sha256');
await pipeline(createReadStream(path.join(dir, manifest.dump.file)), hash);
if (hash.digest('hex') !== manifest.dump.sha256) {
  console.error('db.dump không khớp sha256 trong manifest — dừng lại.');
  process.exit(1);
}

const db = readDatabase();
if (!yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `Khôi phục "${name}" sẽ GHI ĐÈ database "${db.name}" và thư mục data/storage. Gõ "yes" để tiếp tục: `,
  );
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Đã hủy.');
    process.exit(0);
  }
}

console.log('Khôi phục database…');
const child = spawn(pgTool('pg_restore'), ['--clean', '--if-exists', '--no-owner', '--dbname', db.url], {
  cwd: REPO_ROOT,
  stdio: ['pipe', 'inherit', 'inherit'],
});
const exit = new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('close', (code) =>
    code === 0 ? resolve() : reject(new Error(`pg_restore thoát với mã ${code}`)),
  );
});
await Promise.all([pipeline(createReadStream(path.join(dir, manifest.dump.file)), child.stdin), exit]);

const savedStorage = path.join(dir, manifest.storage.dir);
if (existsSync(savedStorage)) {
  console.log('Khôi phục data/storage…');
  await fs.rm(STORAGE_DIR, { recursive: true, force: true });
  await fs.cp(savedStorage, STORAGE_DIR, { recursive: true });
}
console.log('Khôi phục xong.');
