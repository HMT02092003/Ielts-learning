// The exam deadline is server time (spec §6 P3). The client measures its clock offset once per page
// (round trip to GET /time) and every countdown uses serverNow() — so a wrong PC clock cannot add time.
import { attemptsApi } from '@/services/exam.service';

let offsetMs = 0;

export async function syncServerClock(): Promise<number> {
  const t0 = Date.now();
  const { epochMs } = await attemptsApi.time();
  const t1 = Date.now();
  offsetMs = epochMs - (t0 + t1) / 2;
  return offsetMs;
}

/** Also refined from every autosave response (serverNow). */
export function noteServerTime(iso: string): void {
  const server = Date.parse(iso);
  if (Number.isFinite(server)) offsetMs = server - Date.now();
}

export const serverNow = () => Date.now() + offsetMs;
