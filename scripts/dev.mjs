// npm run dev — one command for local development (see stack.mjs): PostgreSQL check → migrate + seed →
// LanguageTool, backend :40000 and frontend :30000 together, output in this terminal. Ctrl+C stops all three.
import { startStack } from './stack.mjs';

let stack;
try {
  stack = await startStack();
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}
console.log('Ctrl+C để dừng\n');

let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  stack.stop();
  if (process.platform === 'win32') process.exit(code);
  setTimeout(() => process.exit(code), 1500); // POSIX: let children handle SIGINT
};
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
for (const child of stack.children) {
  child.on('close', (code) => {
    if (!stopping) {
      console.error(`\nMột tiến trình đã dừng (mã ${code}). Tắt nốt tiến trình còn lại.`);
      stop(code ?? 1);
    }
  });
}
