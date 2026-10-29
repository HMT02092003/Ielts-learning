// Re-checks WCAG 2.1 contrast of key token pairs straight from src/styles/tokens.css (spec §4: AA).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'src', 'styles', 'tokens.css'), 'utf8');

function block(selectorStart: string): Record<string, string> {
  const start = css.indexOf(selectorStart);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
  );
}

const light = block(':root,\n.force-light,\n.exam-mode {');
const dark = block('.dark {');

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ['ink', 'surface'],
  ['ink', 'background'],
  ['ink-muted', 'surface'],
  ['ink-subtle', 'surface'],
  ['accent-foreground', 'accent'],
  ['accent', 'accent-soft'],
  ['warning-ink', 'warning-soft'],
  ['danger', 'danger-soft'],
  ['success', 'success-soft'],
  ['info', 'info-soft'],
  ['ink-inverse', 'ink'],
  ['highlight-ink', 'highlight'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, t) => {
  it.each(TEXT_PAIRS)('text %s on %s ≥ 4.5:1', (fg, bg) => {
    expect(t[fg], `missing --${fg}`).toBeDefined();
    expect(t[bg], `missing --${bg}`).toBeDefined();
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('control outlines (--border-strong) ≥ 3:1 on surface', () => {
    expect(contrast(t['border-strong']!, t.surface!)).toBeGreaterThanOrEqual(3);
  });
});
