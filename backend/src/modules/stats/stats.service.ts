// Study statistics (spec §6 P6). Daily rows (StudyStat) are rebuilt by the idempotent recomputeDay after every
// submit / card review, so they can always be regenerated from the source tables. Band rules (M9): Reading and
// Listening use whole-section attempts; Writing and Speaking use ONLY bands given by a human grader.
import { prisma } from '../../config/prisma';
import { addDays, asDbDate, dayRange, localDate } from '../../lib/tz';
import type { QuestionType, Role, Skill } from '../../shared/enums';
import {
  STUDY_DEFAULTS,
  type BandTrendDto,
  type DashboardDto,
  type HeatmapDto,
  type SkillBand,
} from '../../shared/study';
import { meanBand } from '../../shared/writing';
import { filterToScope, loadSection, type SectionContent } from '../attempts/attempt-content.service';
import { attemptsService } from '../attempts/attempts.service';
import { catalogService } from '../catalog/catalog.service';

const SKILLS: Skill[] = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'];
const MAX_FALLBACK_SECONDS = 2 * 3600;

interface BandEvent {
  skill: Skill;
  band: number;
  at: Date;
}

/** Every band the student has earned, oldest first (R/L section attempts + human W/S grades). */
async function bandEvents(userId: string): Promise<BandEvent[]> {
  const [rl, writing, speaking] = await Promise.all([
    prisma.attempt.findMany({
      where: {
        userId,
        isPreview: false,
        scope: 'SECTION',
        band: { not: null },
        status: { in: ['SUBMITTED', 'EXPIRED'] },
      },
      select: { band: true, submittedAt: true, section: { select: { skill: true } } },
    }),
    prisma.writingEvaluation.findMany({
      where: {
        evaluator: 'HUMAN',
        bandOverall: { not: null },
        submission: { userId, attempt: { isPreview: false } },
      },
      select: {
        bandOverall: true,
        createdAt: true,
        submission: { select: { attemptId: true, part: { select: { number: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.speakingEvaluation.findMany({
      where: { evaluator: 'HUMAN', bandOverall: { not: null }, attempt: { userId, isPreview: false } },
      select: { bandOverall: true, createdAt: true },
    }),
  ]);
  const events: BandEvent[] = [];
  for (const a of rl)
    if (a.band !== null && a.submittedAt)
      events.push({ skill: a.section.skill, band: a.band, at: a.submittedAt });
  // Writing: per attempt, latest human grade of each task; Task 2 counts twice as much as Task 1 (IELTS rule).
  const byAttempt = new Map<string, { t1?: number; t2?: number; at: Date }>();
  for (const w of writing) {
    const cur = byAttempt.get(w.submission.attemptId) ?? { at: w.createdAt };
    if (w.submission.part.number === 1) cur.t1 = w.bandOverall ?? undefined;
    else cur.t2 = w.bandOverall ?? undefined;
    cur.at = w.createdAt;
    byAttempt.set(w.submission.attemptId, cur);
  }
  for (const v of byAttempt.values()) {
    const band =
      v.t1 !== undefined && v.t2 !== undefined ? Math.round(((v.t1 + 2 * v.t2) / 3) * 2) / 2 : (v.t2 ?? v.t1);
    if (band !== undefined) events.push({ skill: 'WRITING', band, at: v.at });
  }
  for (const s of speaking)
    if (s.bandOverall !== null) events.push({ skill: 'SPEAKING', band: s.bandOverall, at: s.createdAt });
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function latestBySkill(events: BandEvent[]): SkillBand[] {
  return SKILLS.map((skill) => {
    const mine = events.filter((e) => e.skill === skill);
    const last = mine.at(-1);
    return { skill, band: last?.band ?? null, attempts: mine.length, lastAt: last?.at.toISOString() ?? null };
  });
}

function counts(s: { activeSeconds: number; attemptsSubmitted: number; vocabReviewed: number }) {
  return (
    s.activeSeconds >= STUDY_DEFAULTS.streakMinSeconds ||
    s.attemptsSubmitted > 0 ||
    s.vocabReviewed >= STUDY_DEFAULTS.streakMinReviews
  );
}

export const statsService = {
  /** Rebuild one user's StudyStat row for a local calendar day (idempotent). */
  async recomputeDay(userId: string, date: string) {
    const { start, end } = dayRange(date);
    const inDay = { gte: start, lt: end };
    const [submitted, started, words, recordings, vocabAdded, vocabReviewed] = await Promise.all([
      prisma.attempt.findMany({
        where: { userId, isPreview: false, status: { in: ['SUBMITTED', 'EXPIRED'] }, submittedAt: inDay },
        select: {
          id: true,
          startedAt: true,
          submittedAt: true,
          attemptParts: { select: { timeSpentMs: true } },
          answers: { select: { value: true, isCorrect: true } },
        },
      }),
      prisma.attempt.count({ where: { userId, isPreview: false, startedAt: inDay } }),
      prisma.writingSubmission.aggregate({
        where: { userId, submittedAt: inDay },
        _sum: { wordCount: true },
      }),
      prisma.speakingRecording.aggregate({ where: { userId, createdAt: inDay }, _sum: { durationMs: true } }),
      prisma.vocabulary.count({ where: { userId, createdAt: inDay } }),
      prisma.vocabularyReview.count({ where: { vocabulary: { userId }, reviewedAt: inDay } }),
    ]);
    let activeSeconds = 0;
    let answered = 0;
    let correct = 0;
    for (const a of submitted) {
      const measured = a.attemptParts.reduce((s, p) => s + p.timeSpentMs, 0) / 1000;
      const elapsed =
        a.startedAt && a.submittedAt ? (a.submittedAt.getTime() - a.startedAt.getTime()) / 1000 : 0;
      activeSeconds +=
        measured > 0 ? Math.min(measured, elapsed || measured) : Math.min(elapsed, MAX_FALLBACK_SECONDS);
      answered += a.answers.filter((x) => x.value !== null).length;
      correct += a.answers.filter((x) => x.isCorrect === true).length;
    }
    const data = {
      activeSeconds: Math.round(activeSeconds),
      attemptsStarted: started,
      attemptsSubmitted: submitted.length,
      questionsAnswered: answered,
      questionsCorrect: correct,
      wordsWritten: words._sum.wordCount ?? 0,
      speakingSeconds: Math.round((recordings._sum.durationMs ?? 0) / 1000),
      vocabAdded,
      vocabReviewed,
    };
    await prisma.studyStat.upsert({
      where: { userId_date: { userId, date: asDbDate(date) } },
      create: { userId, date: asDbDate(date), ...data },
      update: data,
    });
  },

  async onActivity(userId: string, at: Date) {
    await statsService.recomputeDay(userId, localDate(at));
  },

  async dashboard(actor: { id: string; role: Role }): Promise<DashboardDto> {
    const now = new Date();
    const today = localDate(now);
    await statsService.recomputeDay(actor.id, today);
    const [user, events, open, created, due, total, statRows, weak, library, hidden] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { displayName: true, targetBand: true, examDate: true },
      }),
      bandEvents(actor.id),
      attemptsService.list(actor, { status: 'IN_PROGRESS', page: 1, pageSize: 1 }),
      attemptsService.list(actor, { status: 'CREATED', page: 1, pageSize: 1 }),
      prisma.vocabulary.count({ where: { userId: actor.id, isSuspended: false, dueAt: { lte: now } } }),
      prisma.vocabulary.count({ where: { userId: actor.id } }),
      prisma.studyStat.findMany({
        where: { userId: actor.id, date: { gte: asDbDate(addDays(today, -400)) } },
        orderBy: { date: 'asc' },
      }),
      statsService.weakTypes(actor.id),
      catalogService.list(actor.id, { page: 1, pageSize: 30, done: 'false' }),
      prisma.userTestMark.findMany({
        where: { userId: actor.id, hidden: true },
        select: { seriesKey: true },
      }),
    ]);

    const bySkill = latestBySkill(events);
    const known = bySkill.flatMap((b) => (b.band === null ? [] : [b.band]));
    const statByDate = new Map(statRows.map((s) => [s.date.toISOString().slice(0, 10), s]));
    // Current streak: today counts if already active; otherwise it runs up to yesterday.
    let current = 0;
    const todayStat = statByDate.get(today);
    let day = todayStat && counts(todayStat) ? today : addDays(today, -1);
    for (let s = statByDate.get(day); s && counts(s); s = statByDate.get(day)) {
      current += 1;
      day = addDays(day, -1);
    }
    let best = 0;
    let run = 0;
    let prev: string | null = null;
    for (const s of statRows) {
      const d = s.date.toISOString().slice(0, 10);
      if (!counts(s)) {
        run = 0;
        prev = d;
        continue;
      }
      run = prev !== null && addDays(prev, 1) === d && run > 0 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    const examDate = user.examDate?.toISOString().slice(0, 10) ?? null;
    const hiddenKeys = new Set(hidden.map((h) => h.seriesKey));

    return {
      displayName: user.displayName,
      targetBand: user.targetBand,
      examDate,
      daysLeft: examDate
        ? Math.max(0, Math.round((asDbDate(examDate).getTime() - asDbDate(today).getTime()) / 86_400_000))
        : null,
      continueAttempt: open.items[0] ?? created.items[0] ?? null,
      bandBySkill: bySkill,
      overallBand: known.length === 4 ? meanBand(known) : null,
      weakTypes: weak,
      streak: {
        current,
        best: Math.max(best, current),
        todayMinutes: Math.round((statByDate.get(today)?.activeSeconds ?? 0) / 60),
      },
      cards: { due, total },
      suggestions: library.items
        .filter((t) => !hiddenKeys.has(t.seriesKey))
        .slice(0, 4)
        .map((t) => ({
          testId: t.id,
          title: t.title,
          source: t.source,
          skills: t.sections.map((s) => s.skill),
        })),
    };
  },

  /** Accuracy per question type over the last 50 Reading/Listening attempts (blank = wrong). */
  async weakTypes(userId: string) {
    const attempts = await prisma.attempt.findMany({
      where: {
        userId,
        isPreview: false,
        status: { in: ['SUBMITTED', 'EXPIRED'] },
        section: { skill: { in: ['READING', 'LISTENING'] } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        sectionId: true,
        scope: true,
        partId: true,
        questionTypes: true,
        questionNumbers: true,
        answers: { select: { questionId: true, isCorrect: true } },
      },
    });
    const sections = new Map<string, SectionContent>();
    const tally = new Map<QuestionType, { correct: number; total: number }>();
    for (const a of attempts) {
      let section = sections.get(a.sectionId);
      if (!section) {
        section = await loadSection(a.sectionId);
        sections.set(a.sectionId, section);
      }
      const ok = new Set(a.answers.filter((x) => x.isCorrect).map((x) => x.questionId));
      for (const p of filterToScope(section, a))
        for (const g of p.groups)
          for (const q of g.questions) {
            const t = tally.get(g.type) ?? { correct: 0, total: 0 };
            t.total += 1;
            if (ok.has(q.id)) t.correct += 1;
            tally.set(g.type, t);
          }
    }
    return [...tally.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .filter(
        (t) =>
          t.total >= STUDY_DEFAULTS.weakTypeMinQuestions &&
          t.correct / t.total < STUDY_DEFAULTS.weakTypeAccuracy,
      )
      .sort((x, y) => x.correct / x.total - y.correct / y.total)
      .slice(0, 5);
  },

  async bandTrend(userId: string, q: { skill: string; range: '4w' | '8w' | 'all' }): Promise<BandTrendDto> {
    const events = await bandEvents(userId);
    const since = q.range === 'all' ? 0 : Date.now() - (q.range === '4w' ? 28 : 56) * 86_400_000;
    const byDate = new Map<string, number>();
    if (q.skill === 'OVERALL') {
      const latest = new Map<Skill, number>();
      for (const e of events) {
        latest.set(e.skill, e.band);
        if (latest.size === 4) byDate.set(localDate(e.at), meanBand([...latest.values()]));
      }
    } else for (const e of events) if (e.skill === q.skill) byDate.set(localDate(e.at), e.band);
    return {
      skill: q.skill,
      points: [...byDate.entries()]
        .filter(([d]) => asDbDate(d).getTime() >= since - 86_400_000)
        .map(([date, band]) => ({ date, band })),
    };
  },

  async heatmap(userId: string, days: number): Promise<HeatmapDto> {
    const today = localDate(new Date());
    const from = addDays(today, -(days - 1));
    const rows = await prisma.studyStat.findMany({
      where: { userId, date: { gte: asDbDate(from), lte: asDbDate(today) } },
      select: { date: true, activeSeconds: true },
    });
    const byDate = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r.activeSeconds]));
    const [l1, l2, l3] = STUDY_DEFAULTS.heatmapLevels;
    const out: HeatmapDto['days'] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(from, i);
      const minutes = Math.round((byDate.get(date) ?? 0) / 60);
      out.push({ date, minutes, level: minutes >= l3 ? 3 : minutes >= l2 ? 2 : minutes >= l1 ? 1 : 0 });
    }
    return { days: out };
  },

  async radar(userId: string) {
    return { skills: latestBySkill(await bandEvents(userId)) };
  },

  /** Manual "đã làm" marks (seriesKey → true); unmarking returns to the automatic value. */
  async markedDone(userId: string, seriesKeys: string[]) {
    const rows = await prisma.userTestMark.findMany({
      where: { userId, seriesKey: { in: seriesKeys }, doneAt: { not: null } },
      select: { seriesKey: true },
    });
    return new Map(rows.map((r) => [r.seriesKey, true]));
  },

  async setMark(userId: string, seriesKey: string, body: { done?: boolean; hidden?: boolean }) {
    const data = {
      ...(body.done !== undefined ? { doneAt: body.done ? new Date() : null } : {}),
      ...(body.hidden !== undefined ? { hidden: body.hidden } : {}),
    };
    const row = await prisma.userTestMark.upsert({
      where: { userId_seriesKey: { userId, seriesKey } },
      create: { userId, seriesKey, ...data },
      update: data,
    });
    return { seriesKey, done: row.doneAt !== null, hidden: row.hidden };
  },
};
