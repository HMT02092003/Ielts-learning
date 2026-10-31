// Book sets (source + bookNumber): grouped listings for the admin and the student library, export and bulk
// publish by set. Sets are derived from Test rows; there is no table.
import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { AppError, notFound } from '../../lib/errors';
import { SOURCE_PRIORITY, type Skill, type TestSource } from '../../shared/enums';
import {
  parseSetKey,
  setKeyOf,
  setTitleOf,
  type AdminSetTestDto,
  type AdminTestSetDto,
  type ListSetsQuery,
  type StudentTestSetDto,
} from '../../shared/test-sets';
import { cardInclude, toCards } from '../catalog/catalog.service';

const SKILL_ORDER: Skill[] = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'];

type SetHead = { setKey: string; source: TestSource; bookNumber: number | null; title: string };

function whereOf(q: ListSetsQuery): Prisma.TestWhereInput {
  return {
    ...(q.source ? { source: q.source } : {}),
    ...(q.q
      ? {
          OR: [
            { title: { contains: q.q, mode: 'insensitive' } },
            { seriesKey: { contains: q.q.toLowerCase() } },
          ],
        }
      : {}),
  };
}

/** Sources in library order, then newest book first; the loose set (no book) last within a source. */
function compareSets(a: SetHead, b: SetHead): number {
  return SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source] || (b.bookNumber ?? -1) - (a.bookNumber ?? -1);
}

const byTestNumber = (a: { testNumber: number | null; title: string }, b: typeof a) =>
  (a.testNumber ?? Number.MAX_SAFE_INTEGER) - (b.testNumber ?? Number.MAX_SAFE_INTEGER) ||
  a.title.localeCompare(b.title);

function groupBySet<T extends { source: TestSource; bookNumber: number | null }>(rows: T[]) {
  const sets = new Map<string, SetHead & { rows: T[] }>();
  for (const r of rows) {
    const setKey = setKeyOf(r.source, r.bookNumber);
    let s = sets.get(setKey);
    if (!s) {
      s = {
        setKey,
        source: r.source,
        bookNumber: r.bookNumber,
        title: setTitleOf(r.source, r.bookNumber),
        rows: [],
      };
      sets.set(setKey, s);
    }
    s.rows.push(r);
  }
  return [...sets.values()].sort(compareSets);
}

function setWhere(setKey: string): Prisma.TestWhereInput {
  const parsed = parseSetKey(setKey);
  if (!parsed) throw new AppError('VALIDATION_ERROR', 'Mã bộ đề không hợp lệ');
  return { source: parsed.source, bookNumber: parsed.bookNumber };
}

export const testSetsService = {
  async listAdmin(q: ListSetsQuery): Promise<AdminTestSetDto[]> {
    const rows = await prisma.test.findMany({
      where: whereOf(q),
      select: {
        id: true,
        seriesKey: true,
        version: true,
        status: true,
        source: true,
        type: true,
        title: true,
        bookNumber: true,
        testNumber: true,
        sections: { select: { skill: true } },
      },
      orderBy: { version: 'desc' },
    });
    return groupBySet(rows).map(({ rows: setRows, ...head }) => {
      // Rows come ordered by version desc, so the first row seen for a series is its latest version.
      const series = new Map<
        string,
        { latest: (typeof setRows)[number]; published?: (typeof setRows)[number] }
      >();
      for (const r of setRows) {
        const s = series.get(r.seriesKey) ?? { latest: r };
        if (r.status === 'PUBLISHED') s.published = r;
        series.set(r.seriesKey, s);
      }
      const tests: AdminSetTestDto[] = [...series.values()].map(({ latest, published }) => {
        return {
          seriesKey: latest.seriesKey,
          testNumber: latest.testNumber,
          title: latest.title,
          type: latest.type,
          latest: {
            id: latest.id,
            status: latest.status,
            version: latest.version,
            skills: latest.sections
              .map((s) => s.skill)
              .sort((a, b) => SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b)),
          },
          published: published ? { id: published.id, version: published.version } : null,
        };
      });
      tests.sort(byTestNumber);
      return {
        ...head,
        tests,
        counts: {
          draft: setRows.filter((r) => r.status === 'DRAFT').length,
          published: setRows.filter((r) => r.status === 'PUBLISHED').length,
        },
      };
    });
  },

  async listStudent(userId: string, q: ListSetsQuery): Promise<StudentTestSetDto[]> {
    const rows = await prisma.test.findMany({
      where: { ...whereOf(q), status: 'PUBLISHED' },
      include: cardInclude,
    });
    const cards = new Map((await toCards(rows, userId)).map((c) => [c.id, c]));
    return groupBySet(rows).map(({ rows: setRows, ...head }) => ({
      ...head,
      tests: setRows.sort(byTestNumber).flatMap((r) => {
        const card = cards.get(r.id);
        return card ? [card] : [];
      }),
    }));
  },

  /** One test per series of the set: its latest version, or its published one. */
  async testsInSet(
    setKey: string,
    include: 'latest' | 'published',
  ): Promise<{ id: string; seriesKey: string; version: number; status: string }[]> {
    const rows = await prisma.test.findMany({
      where: { ...setWhere(setKey), ...(include === 'published' ? { status: 'PUBLISHED' } : {}) },
      select: { id: true, seriesKey: true, version: true, status: true, testNumber: true, title: true },
      orderBy: { version: 'desc' },
    });
    const seen = new Set<string>();
    const picked = rows.filter((r) => !seen.has(r.seriesKey) && seen.add(r.seriesKey));
    if (picked.length === 0) throw notFound('Bộ đề');
    return picked
      .sort(byTestNumber)
      .map(({ id, seriesKey, version, status }) => ({ id, seriesKey, version, status }));
  },
};
