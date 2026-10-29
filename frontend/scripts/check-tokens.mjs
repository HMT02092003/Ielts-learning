// Guards spec §4 "no hard-coded colour/font/radius/shadow in components":
//  1. no hex / rgb() / hsl() colour literals in src/{app,components,hooks,lib} (tokens.css is the only source);
//  2. shadcn components must not use `bg-accent` for hover/focus — in this design `accent` is the brand
//     colour, not shadcn's "hover background" (design conflict #22, see docs/design-tokens.md).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', 'src');
const DIRS = ['app', 'components', 'hooks', 'lib'];
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/;
const SHADCN_ACCENT =
  /(?:hover|focus|focus-visible|data-\[highlighted\]):bg-accent(?![\w-])|focus:text-accent-foreground/;

const files = DIRS.flatMap((d) => {
  const dir = path.join(ROOT, d);
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { recursive: true })
        .map((f) => path.join(dir, String(f)))
        .filter((f) => /\.(tsx?|css)$/.test(f))
    : [];
});

const problems = [];
for (const file of files) {
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (line.includes('check-tokens: allow')) return;
      if (COLOUR.test(line)) problems.push(`${path.relative(ROOT, file)}:${i + 1} màu hard-code`);
      if (file.includes(`${path.sep}ui${path.sep}`) && SHADCN_ACCENT.test(line)) {
        problems.push(
          `${path.relative(ROOT, file)}:${i + 1} shadcn dùng bg-accent làm nền hover — đổi sang bg-surface-muted`,
        );
      }
    });
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`check-tokens: ${files.length} file sạch.`);
