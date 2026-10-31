// Pure helpers for the "by book set" views (admin test list, student practice library).
import type { Skill, TestStatus } from '@/shared/enums';
import type { AdminTestSetDto } from '@/shared/test-sets';

export const SKILLS: Skill[] = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'];

export type ViewMode = 'sets' | 'list';

export interface SkillRow {
  seriesKey: string;
  id: string;
  title: string;
  status: TestStatus;
  skills: Record<Skill, boolean>;
}

/** One row per test of the set: which skills its latest version has. */
export function skillMatrix(set: AdminTestSetDto): SkillRow[] {
  return set.tests.map((t) => ({
    seriesKey: t.seriesKey,
    id: t.latest.id,
    title: t.title,
    status: t.latest.status,
    skills: Object.fromEntries(SKILLS.map((s) => [s, t.latest.skills.includes(s)])) as Record<Skill, boolean>,
  }));
}

/** Test number for "Thêm Test": one after the highest in the set. */
export function nextTestNumber(set: AdminTestSetDto): number {
  return Math.max(0, ...set.tests.map((t) => t.testNumber ?? 0)) + 1;
}

/** Remembered view per page; storage may be missing or blocked, so every access is guarded. */
export function readViewPref(key: string, fallback: ViewMode): ViewMode {
  try {
    const v = globalThis.localStorage.getItem(key);
    return v === 'sets' || v === 'list' ? v : fallback;
  } catch {
    return fallback;
  }
}

export function writeViewPref(key: string, value: ViewMode): void {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // Not remembered — the page still works.
  }
}
