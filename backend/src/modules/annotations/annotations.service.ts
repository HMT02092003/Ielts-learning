import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { AppError, notFound } from '../../lib/errors';
import type { AnnotationDto, CreateAnnotationBody } from '../../shared/attempt';
import type { Role } from '../../shared/enums';

type Row = Prisma.AnnotationGetPayload<object>;

const toDto = (a: Row): AnnotationDto => ({
  id: a.id,
  clientId: a.clientId,
  kind: a.kind,
  targetKind: a.targetKind,
  targetId: a.paragraphId ?? a.questionId ?? a.questionGroupId ?? '',
  field: a.field,
  startOffset: a.startOffset,
  endOffset: a.endOffset,
  exact: a.exact,
  note: a.note,
});

async function ownAttempt(attemptId: string, actor: { id: string; role: Role }, write: boolean) {
  const a = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { userId: true, sectionId: true },
  });
  if (!a || (a.userId !== actor.id && (write || actor.role !== 'ADMIN'))) throw notFound('Bài làm');
  return a;
}

export const annotationsService = {
  async list(attemptId: string, actor: { id: string; role: Role }): Promise<AnnotationDto[]> {
    await ownAttempt(attemptId, actor, false);
    const rows = await prisma.annotation.findMany({ where: { attemptId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toDto);
  },

  /** Idempotent on (attemptId, clientId): a retried request returns the existing annotation. */
  async create(
    attemptId: string,
    actor: { id: string; role: Role },
    b: CreateAnnotationBody,
  ): Promise<AnnotationDto> {
    const attempt = await ownAttempt(attemptId, actor, true);
    const existing = await prisma.annotation.findUnique({
      where: { attemptId_clientId: { attemptId, clientId: b.clientId } },
    });
    if (existing) return toDto(existing);

    // The target must belong to this attempt's test section, and the offsets must point at the quoted text.
    let text: string | null = null;
    if (b.targetKind === 'PARAGRAPH') {
      const p = await prisma.paragraph.findFirst({
        where: { id: b.targetId, passage: { part: { sectionId: attempt.sectionId } } },
        select: { text: true },
      });
      text = p?.text ?? null;
    } else if (b.targetKind === 'QUESTION') {
      const q = await prisma.question.findFirst({
        where: { id: b.targetId, sectionId: attempt.sectionId },
        select: { prompt: true },
      });
      text = q?.prompt ?? null;
    } else {
      const g = await prisma.questionGroup.findFirst({
        where: { id: b.targetId, part: { sectionId: attempt.sectionId } },
        select: { instructions: true },
      });
      text = g?.instructions ?? null;
    }
    if (text === null) throw notFound('Đoạn văn');
    if (text.slice(b.startOffset, b.endOffset) !== b.exact) {
      throw new AppError('VALIDATION_ERROR', 'Vị trí đánh dấu không khớp với nội dung');
    }
    const row = await prisma.annotation.create({
      data: {
        attemptId,
        clientId: b.clientId,
        kind: b.kind,
        targetKind: b.targetKind,
        paragraphId: b.targetKind === 'PARAGRAPH' ? b.targetId : null,
        questionId: b.targetKind === 'QUESTION' ? b.targetId : null,
        questionGroupId: b.targetKind === 'GROUP' ? b.targetId : null,
        field:
          b.targetKind === 'PARAGRAPH'
            ? null
            : (b.field ?? (b.targetKind === 'QUESTION' ? 'prompt' : 'instructions')),
        startOffset: b.startOffset,
        endOffset: b.endOffset,
        exact: b.exact,
        prefix: b.prefix,
        suffix: b.suffix,
        note: b.note,
      },
    });
    return toDto(row);
  },

  async update(
    id: string,
    actor: { id: string; role: Role },
    body: { note?: string | null; kind?: 'HIGHLIGHT' | 'NOTE' },
  ) {
    const a = await prisma.annotation.findUnique({ where: { id }, select: { attemptId: true } });
    if (!a) throw notFound('Ghi chú');
    await ownAttempt(a.attemptId, actor, true);
    return toDto(await prisma.annotation.update({ where: { id }, data: body }));
  },

  async remove(id: string, actor: { id: string; role: Role }): Promise<void> {
    const a = await prisma.annotation.findUnique({ where: { id }, select: { attemptId: true } });
    if (!a) throw notFound('Ghi chú');
    await ownAttempt(a.attemptId, actor, true);
    await prisma.annotation.delete({ where: { id } });
  },
};
