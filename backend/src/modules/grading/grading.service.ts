// Admin grading queue (spec §6 P5): submitted Writing tasks and Speaking attempts, pending = no HUMAN review yet.
import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import type { GradingQueueItem } from '../../shared/writing';

export const gradingService = {
  async queue(q: {
    kind: 'WRITING' | 'SPEAKING';
    status: 'PENDING' | 'REVIEWED' | 'ALL';
    page: number;
    pageSize: number;
  }) {
    const skip = (q.page - 1) * q.pageSize;
    if (q.kind === 'WRITING') {
      const human = { some: { evaluator: 'HUMAN' as const } };
      const where: Prisma.WritingSubmissionWhereInput = {
        status: 'SUBMITTED',
        attempt: { isPreview: false },
        ...(q.status === 'PENDING' ? { evaluations: { none: { evaluator: 'HUMAN' } } } : {}),
        ...(q.status === 'REVIEWED' ? { evaluations: human } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.writingSubmission.findMany({
          where,
          orderBy: { submittedAt: 'asc' },
          skip,
          take: q.pageSize,
          include: {
            user: { select: { displayName: true } },
            part: { select: { number: true } },
            attempt: { select: { test: { select: { title: true } } } },
            evaluations: {
              where: { evaluator: 'HUMAN' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { bandOverall: true },
            },
          },
        }),
        prisma.writingSubmission.count({ where }),
      ]);
      const items: GradingQueueItem[] = rows.map((r) => ({
        kind: 'WRITING',
        id: r.id,
        attemptId: r.attemptId,
        userName: r.user.displayName,
        testTitle: r.attempt.test.title,
        label: `Task ${r.part.number} · ${r.wordCount} từ`,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        reviewed: r.evaluations.length > 0,
        bandOverall: r.evaluations[0]?.bandOverall ?? null,
      }));
      return { items, page: q.page, pageSize: q.pageSize, total };
    }

    const where: Prisma.AttemptWhereInput = {
      section: { skill: 'SPEAKING' },
      status: { in: ['SUBMITTED', 'EXPIRED'] },
      isPreview: false,
      ...(q.status === 'PENDING' ? { speakingEvaluations: { none: { evaluator: 'HUMAN' } } } : {}),
      ...(q.status === 'REVIEWED' ? { speakingEvaluations: { some: { evaluator: 'HUMAN' } } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.attempt.findMany({
        where,
        orderBy: { submittedAt: 'asc' },
        skip,
        take: q.pageSize,
        include: {
          user: { select: { displayName: true } },
          test: { select: { title: true } },
          _count: { select: { speakingRecordings: true } },
          speakingEvaluations: {
            where: { evaluator: 'HUMAN' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { bandOverall: true },
          },
        },
      }),
      prisma.attempt.count({ where }),
    ]);
    const items: GradingQueueItem[] = rows.map((r) => ({
      kind: 'SPEAKING',
      id: r.id,
      attemptId: r.id,
      userName: r.user.displayName,
      testTitle: r.test.title,
      label: `${r._count.speakingRecordings} bản ghi`,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      reviewed: r.speakingEvaluations.length > 0,
      bandOverall: r.speakingEvaluations[0]?.bandOverall ?? null,
    }));
    return { items, page: q.page, pageSize: q.pageSize, total };
  },
};
