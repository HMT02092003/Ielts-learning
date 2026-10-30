// npm run check   → `yarn run check` in backend/ then frontend/
// npm run backup  → backend backup;  npm run restore [-- <name> --yes] → backend restore
import { BACKEND, FRONTEND, YARN, run } from './lib.mjs';

const [task, ...rest] = process.argv.slice(2);
const extra = rest.map((a) => JSON.stringify(a)).join(' ');

if (task === 'check') {
  console.log('▶ backend: yarn run check');
  await run(`${YARN} run check`, BACKEND);
  console.log('\n▶ frontend: yarn run check');
  await run(`${YARN} run check`, FRONTEND);
} else if (task === 'backup' || task === 'restore') {
  await run(`${YARN} run ${task} ${extra}`.trim(), BACKEND);
} else {
  console.error(`Không biết tác vụ "${task}"`);
  process.exit(1);
}
