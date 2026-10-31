// npm run app (or BandUp.vbs / the desktop shortcut) — open BandUp as an app window:
//   start the stack hidden (output → data/logs/app-<date>.log), wait for the web, open Edge in app mode with its own
//   profile, and stop the stack when that window closes. If BandUp is already running (e.g. `npm run dev` in a
//   terminal), only the window is opened and the servers are left alone.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { portBusy, ROOT } from './lib.mjs';
import { startStack } from './stack.mjs';

const APP_URL = 'http://localhost:30000';
const READY_TIMEOUT_MS = 180_000;

const day = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time
const logDir = path.join(ROOT, 'data', 'logs');
mkdirSync(logDir, { recursive: true });
const logPath = path.join(logDir, `app-${day}.log`);
const log = createWriteStream(logPath, { flags: 'a' });
const write = (text) => log.write(text);
write(`\n===== ${new Date().toISOString()} BandUp app =====\n`);

/** Windows message box (the launcher has no console to print to). */
function alertBox(message) {
  write(`[app] ${message}\n`);
  if (process.platform !== 'win32') return console.error(message);
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($env:BANDUP_MSG, "BandUp") | Out-Null',
    ],
    { env: { ...process.env, BANDUP_MSG: message }, windowsHide: true },
  );
}

function fail(message) {
  alertBox(`BandUp không khởi động được.\n\n${message}\n\nXem log: ${logPath}`);
  log.end(() => process.exit(1));
}

function findEdge() {
  const candidates = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA]
    .filter(Boolean)
    .map((dir) => path.join(dir, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  return candidates.find((p) => existsSync(p));
}

async function waitForWeb() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${APP_URL}/login`, { signal: AbortSignal.timeout(60_000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

const edge = findEdge();
if (!edge) fail('Không tìm thấy Microsoft Edge trên máy.');
else {
  const alreadyRunning = (await portBusy(30000)) && (await portBusy(40000));
  let stack = null;
  if (alreadyRunning) {
    write('[app] BandUp đã chạy sẵn — chỉ mở cửa sổ.\n');
  } else {
    try {
      stack = await startStack({ write });
    } catch (err) {
      fail(err.message);
    }
  }

  if (alreadyRunning || stack) {
    let stopping = false;
    const shutdown = (code) => {
      if (stopping) return;
      stopping = true;
      stack?.stop();
      write(`[app] Đã tắt (mã ${code}).\n`);
      log.end(() => process.exit(code));
    };
    for (const child of stack?.children ?? []) {
      child.on('close', (code) => {
        if (stopping) return;
        alertBox(`Một tiến trình của BandUp đã dừng (mã ${code}). Xem log: ${logPath}`);
        shutdown(1);
      });
    }

    if (!(await waitForWeb())) {
      stack?.stop();
      fail(`Web không sẵn sàng sau ${READY_TIMEOUT_MS / 1000} giây.`);
    } else {
      write('[app] Mở cửa sổ BandUp.\n');
      const win = spawn(
        edge,
        [
          `--app=${APP_URL}`,
          `--user-data-dir=${path.join(ROOT, 'data', 'edge-profile')}`,
          '--no-first-run',
          '--no-default-browser-check',
        ],
        { stdio: 'ignore' },
      );
      win.on('exit', () => shutdown(0));
      win.on('error', (err) => {
        alertBox(`Không mở được Edge: ${err.message}`);
        shutdown(1);
      });
    }
  }
}
