// yarn run backup → data/backups/<timestamp>/{db.dump, storage/, manifest.json}
// Runs the host's pg_dump against DATABASE_URL and streams the dump in Node (no shell redirect, so the
// binary dump is never re-encoded by PowerShell).
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { pgTool, readDatabase, REPO_ROOT, STORAGE_DIR } from './common.mjs';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(REPO_ROOT, 'data', 'backups', stamp);
await fs.mkdir(outDir, { recursive: true });
const db = readDatabase();

console.log(`Sao lưu database "${db.name}" → ${outDir}`);
const dumpPath = path.join(outDir, 'db.dump');
const child = spawn(pgTool('pg_dump'), ['--dbname', db.url, '-Fc'], {
  cwd: REPO_ROOT,
  stdio: ['ignore', 'pipe', 'inherit'],
});
const exit = new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump thoát với mã ${code}`))));
});
await Promise.all([pipeline(child.stdout, createWriteStream(dumpPath)), exit]);

const hash = createHash('sha256');
await pipeline(createReadStream(dumpPath), hash);
const dumpStat = await fs.stat(dumpPath);

let fileCount = 0;
if (existsSync(STORAGE_DIR)) {
  await fs.cp(STORAGE_DIR, path.join(outDir, 'storage'), { recursive: true });
  const entries = await fs.readdir(path.join(outDir, 'storage'), { recursive: true, withFileTypes: true });
  fileCount = entries.filter((e) => e.isFile()).length;
}

const manifest = {
  createdAt: new Date().toISOString(),
  database: db.name,
  dump: { file: 'db.dump', sizeBytes: dumpStat.size, sha256: hash.digest('hex') },
  storage: { dir: 'storage', files: fileCount },
};
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Xong: dump ${dumpStat.size} byte, ${fileCount} file storage.`);
