// Calendar days in APP_TIMEZONE (study stats, streaks, heatmap). Dates are "YYYY-MM-DD" strings.
import { env } from '../config/env';

const fmt = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = fmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    fmt.set(tz, f);
  }
  return f;
}

/** Local calendar date of an instant. */
export function localDate(d: Date, tz = env.APP_TIMEZONE): string {
  return formatter(tz).format(d);
}

/** Offset (ms) of `tz` from UTC at instant `d`. */
function offsetMs(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** [start, end) instants of a local calendar day. */
export function dayRange(date: string, tz = env.APP_TIMEZONE): { start: Date; end: Date } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  const start = new Date(guess - offsetMs(new Date(guess), tz));
  const nextGuess = Date.UTC(y, m - 1, d + 1);
  const end = new Date(nextGuess - offsetMs(new Date(nextGuess), tz));
  return { start, end };
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Prisma @db.Date value for a local date. */
export const asDbDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
