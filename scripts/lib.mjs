// Small helpers shared by the root scripts (no dependencies — only Node built-ins).
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

// npm does not enforce "engines" for `npm run`, so check here (before anything else can fail cryptically).
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  console.error(`Cần Node 20.19 trở lên (đang dùng ${process.versions.node}).`);
  process.exit(1);
}

export const ROOT = path.resolve(import.meta.dirname, '..');
export const BACKEND = path.join(ROOT, 'backend');
export const FRONTEND = path.join(ROOT, 'frontend');

const ENV = { ...process.env };
// Children must find node/npm/yarn even when PATH is stale (a shortcut or a console opened before installing Node):
// add this node's folder and the global npm bin folder.
{
  const key = Object.keys(ENV).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const extra = [path.dirname(process.execPath)];
  if (process.platform === 'win32' && ENV.APPDATA) extra.push(path.join(ENV.APPDATA, 'npm'));
  const parts = (ENV[key] ?? '').split(path.delimiter).filter(Boolean);
  ENV[key] = [...parts, ...extra.filter((d) => !parts.includes(d))].join(path.delimiter);
}

/**
 * How to invoke Yarn 1: the global `yarn` when installed, otherwise the exact version pinned in
 * backend/package.json through npx. Always `yarn run <script>`: some names (e.g. `check`) are Yarn built-ins.
 */
export const YARN = (() => {
  if (spawnSync('yarn --version', { shell: true, stdio: 'ignore', env: ENV }).status === 0) return 'yarn';
  const pinned = JSON.parse(readFileSync(path.join(BACKEND, 'package.json'), 'utf8')).packageManager;
  return `npx --yes ${pinned}`;
})();

const toConsole = (text) => process.stdout.write(text);

/**
 * Run a command (through the shell, so `yarn`/`docker` resolve the same on Windows and Linux). Output goes to the
 * console, or to `write` (e.g. a log file) when given.
 */
export function run(command, cwd = ROOT, write) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: write ? ['ignore', 'pipe', 'pipe'] : 'inherit', env: ENV });
    if (write) for (const stream of [child.stdout, child.stderr]) stream.on('data', (c) => write(c.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`"${command}" thoát với mã ${code}`))));
  });
}

/** Start a long-running command whose output lines are prefixed with a coloured tag (to the console or `write`). */
export function startPrefixed(tag, colour, command, cwd, write = toConsole) {
  // stdin must be 'ignore': with an open stdin pipe `tsx watch` never starts the server.
  const child = spawn(command, {
    cwd,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...ENV, FORCE_COLOR: write === toConsole ? '1' : '0' },
  });
  const prefix = write === toConsole ? `\x1b[${colour}m[${tag}]\x1b[0m ` : `[${tag}] `;
  for (const stream of [child.stdout, child.stderr]) {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      for (const line of lines) write(prefix + line + '\n');
    });
  }
  return child;
}

/**
 * Kill a child and everything it started. Windows: synchronous `taskkill /T` (a shell-spawned tree ignores
 * signals, and an async taskkill could itself be killed when this process exits). POSIX: SIGINT the child.
 */
export function killTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGINT');
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(400, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function canListen(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

/** Busy if something answers on IPv4 or IPv6 loopback, or the port cannot be bound. */
export async function portBusy(port) {
  if ((await canConnect('127.0.0.1', port)) || (await canConnect('::1', port))) return true;
  return !(await canListen(port));
}
