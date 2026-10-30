// Student test library: published tests only, sorted CAM → VOL → Pre-IELTS (spec §1), with the user's progress.
import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { notFound } from '../../lib/errors';
import type { ListTestsQuery, TestCardDto } from '../../shared/attempt';
import { SOURCE_PRIORITY, type Skill } from '../../shared/enums';

const SKILL_ORDER: Skill[] = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'];

const cardInclude = {
  sections: {
    select: {
      id: true,
      skill: true,
      durationSec: true,
      _count: { select: { questions: true } },
      parts: {
        orderBy: { number: 'asc' },
        select: { id: true, number: true, title: true, groups: { select: { type: true } } },
      },
    },
  },
} as const satisfies Prisma.TestInclude;

type CardRow = Prisma.TestGetPayload<{ include: typeof cardInclude }>;

async function toCards(rows: CardRow[], userId: string): Promise<TestCardDto[]> {
  const ids = rows.map((r) => r.id);
  const [attempts, marks] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId, testId: { in: ids }, status: { in: ['SUBMITTED', 'EXPIRED'] }, isPreview: false },
      select: {
        testId: true,
        band: true,
        submittedAt: true,
        scope: true,
        section: { select: { skill: true } },
      },
    }),
    markedDone(
      userId,
      rows.map((r) => r.seriesKey),
    ),
  ]);
  return rows.map((t) => {
    const mine = attempts.filter((a) => a.testId === t.id);
    const sections = [...t.sections].sort(
      (a, b) => SKILL_ORDER.indexOf(a.skill) - SKILL_ORDER.indexOf(b.skill),
    );
    const progress = sections.map((s) => {
      const forSkill = mine.filter((a) => a.section.skill === s.skill);
      const bands = forSkill.flatMap((a) => (a.band === null ? [] : [a.band]));
      const last = forSkill.reduce<Date | null>(
        (d, a) => (a.submittedAt && (!d || a.submittedAt > d) ? a.submittedAt : d),
        null,
      );
      return {
        skill: s.skill,
        attempts: forSkill.length,
        bestBand: bands.length ? Math.max(...bands) : null,
        lastAttemptAt: last?.toISOString() ?? null,
      };
    });
    const doneBySections = sections.every((s) =>
      mine.some((a) => a.section.skill === s.skill && a.scope === 'SECTION'),
    );
    return {
      id: t.id,
      seriesKey: t.seriesKey,
      title: t.title,
      source: t.source,
      type: t.type,
      bookNumber: t.bookNumber,
      testNumber: t.testNumber,
      status: t.status,
      sections: sections.map((s) => ({
        id: s.id,
        skill: s.skill,
        durationSec: s.durationSec,
        questionCount: s._count.questions,
        parts: s.parts.map((p) => ({ id: p.id, number: p.number, title: p.title })),
        questionTypes: [...new Set(s.parts.flatMap((p) => p.groups.map((g) => g.type)))],
      })),
      progress,
      done: marks.has(t.seriesKey) ? (marks.get(t.seriesKey) ?? false) : doneBySections,
    };
  });
}

/** Manual "đánh dấu đã làm" (Phase 6) overrides the automatic value. Replaced by the stats module at boot. */
let markedDone: (userId: string, seriesKeys: string[]) => Promise<Map<string, boolean>> = () =>
  Promise.resolve(new Map<string, boolean>());

export const catalogService = {
  setMarkedDone(fn: typeof markedDone) {
    markedDone = fn;
  },

  async list(userId: string, q: ListTestsQuery) {
    const where: Prisma.TestWhereInput = {
      status: 'PUBLISHED',
      ...(q.source ? { source: q.source } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.skill ? { sections: { some: { skill: q.skill } } } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const rows = await prisma.test.findMany({ where, include: cardInclude });
    rows.sort(
      (a, b) =>
        SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source] ||
        (b.bookNumber ?? 0) - (a.bookNumber ?? 0) ||
        (a.testNumber ?? 0) - (b.testNumber ?? 0) ||
        a.title.localeCompare(b.title),
    );
    let cards = await toCards(rows, userId);
    if (q.done) cards = cards.filter((c) => c.done === (q.done === 'true'));
    const total = cards.length;
    return {
      items: cards.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
      page: q.page,
      pageSize: q.pageSize,
      total,
    };
  },

  async get(userId: string, id: string, isAdmin: boolean): Promise<TestCardDto> {
    const t = await prisma.test.findUnique({ where: { id }, include: cardInclude });
    if (!t || (t.status !== 'PUBLISHED' && !isAdmin)) throw notFound('Đề');
    const [card] = await toCards([t], userId);
    if (!card) throw notFound('Đề');
    return card;
  },
};
