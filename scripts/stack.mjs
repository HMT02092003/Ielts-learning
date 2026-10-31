// The local BandUp stack, shared by `npm run dev` (console) and `npm run app` (hidden, logs to a file):
//   PostgreSQL on this machine (port 5432) → migrate + seed (idempotent) → LanguageTool :8010 (from .tools/),
//   backend :40000 and frontend :30000.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { BACKEND, FRONTEND, YARN, ROOT, killTree, portBusy, run, startPrefixed } from './lib.mjs';

/**
 * Start everything; throws an Error with a Vietnamese message when a precondition fails.
 * `write` receives all output (default: the console). Returns the child processes and a synchronous `stop()`.
 */
export async function startStack({ write } = {}) {
  const say = (line) => (write ? write(`${line}\n`) : console.log(line));

  const needsSetup = [
    path.join(ROOT, '.env'),
    path.join(BACKEND, '.env'),
    path.join(FRONTEND, '.env.local'),
    path.join(BACKEND, 'node_modules'),
    path.join(FRONTEND, 'node_modules'),
  ].some((p) => !existsSync(p));
  if (needsSetup) {
    say('Chưa setup — chạy npm run setup trước…\n');
    await run('node scripts/setup.mjs', ROOT, write);
  }

  for (const port of [30000, 40000]) {
    if (await portBusy(port)) {
      throw new Error(`Cổng ${port} đang bị dùng. Có thể app đang chạy ở cửa sổ khác.`);
    }
  }

  say('▶ PostgreSQL trên máy (127.0.0.1:5432)');
  if (!(await portBusy(5432))) {
    throw new Error('PostgreSQL chưa chạy. Mở services.msc → bật dịch vụ "postgresql-x64-17", rồi mở lại BandUp.');
  }

  say('\n▶ Database: migrate + seed');
  await run(`${YARN} run db:setup`, BACKEND, write);

  const children = [];
  // LanguageTool (Writing estimate) runs from .tools/ — a portable JRE + the LanguageTool server zip.
  const java = path.join(ROOT, '.tools', 'jre', 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  const ltDir = path.join(ROOT, '.tools', 'languagetool');
  if (await portBusy(8010)) {
    say('\n• LanguageTool đã chạy sẵn ở cổng 8010');
  } else if (existsSync(java) && existsSync(path.join(ltDir, 'languagetool-server.jar'))) {
    children.push(
      startPrefixed(
        'lt',
        '33',
        `"${java}" -Xms256m -Xmx1g -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8010`,
        ltDir,
        write,
      ),
    );
  } else {
    say('\n• Không thấy .tools/languagetool — phần ước lượng Writing sẽ không chạy (xem README).');
  }

  say('\n▶ Chạy backend (:40000) và frontend (:30000)\n');
  children.push(
    startPrefixed('api', '36', `${YARN} run dev`, BACKEND, write),
    startPrefixed('web', '35', `${YARN} run dev`, FRONTEND, write),
  );

  return { children, stop: () => children.forEach(killTree) }; // killTree is synchronous on Windows
}
