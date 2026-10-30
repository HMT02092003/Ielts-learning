import { createHash } from 'node:crypto';
import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { AppError, notFound } from '../../lib/errors';
import { bandTableIssues, BandRows, DEFAULT_BAND_TABLES } from '../../lib/scoring/band';
import type { BandTableKind } from '../../shared/enums';
import { BAND_TABLE_LABEL, type BandTableDto, type UpdateBandTableBody } from '../../shared/scoring';

const KINDS: BandTableKind[] = ['LISTENING', 'READING_ACADEMIC', 'READING_GENERAL'];

type Row = Prisma.BandTableGetPayload<object>;

const toDto = (t: Row): BandTableDto => ({
  id: t.id,
  kind: t.kind,
  version: t.version,
  name: t.name,
  rows: BandRows.parse(t.rows),
  note: t.note,
  isReference: t.isReference,
  active: t.activeKind !== null,
  createdAt: t.createdAt.toISOString(),
});

const hashRows = (rows: BandRows) => createHash('sha256').update(JSON.stringify(rows)).digest('hex');

async function createVersion(
  kind: BandTableKind,
  rows: BandRows,
  note: string,
  isReference: boolean,
  createdById: string | null,
): Promise<Row> {
  const issues = bandTableIssues(rows);
  if (issues.length) {
    throw new AppError('VALIDATION_ERROR', 'Bảng band không hợp lệ', {
      issues: issues.map((message) => ({ path: 'rows', code: 'band_table', message })),
    });
  }
  const sorted = [...rows].sort((a, b) => b.minRaw - a.minRaw);
  return prisma.$transaction(async (tx) => {
    const last = await tx.bandTable.findFirst({ where: { kind }, orderBy: { version: 'desc' } });
    await tx.bandTable.updateMany({ where: { activeKind: kind }, data: { activeKind: null } });
    return tx.bandTable.create({
      data: {
        kind,
        version: (last?.version ?? 0) + 1,
        activeKind: kind,
        name: BAND_TABLE_LABEL[kind],
        rows: sorted,
        rowsHash: hashRows(sorted),
        note,
        isReference,
        createdById,
      },
    });
  });
}

export const bandTablesService = {
  /** Seed: create version 1 of each kind from band-tables.json when none exists (idempotent). */
  async ensureDefaults(createdById: string | null): Promise<void> {
    for (const kind of KINDS) {
      const exists = await prisma.bandTable.count({ where: { kind } });
      if (!exists)
        await createVersion(
          kind,
          DEFAULT_BAND_TABLES.tables[kind],
          DEFAULT_BAND_TABLES.note,
          true,
          createdById,
        );
    }
  },

  async active(kind: BandTableKind): Promise<Row> {
    const t = await prisma.bandTable.findUnique({ where: { activeKind: kind } });
    if (t) return t;
    // A fresh database without seed still scores (reference table, version 1).
    return createVersion(kind, DEFAULT_BAND_TABLES.tables[kind], DEFAULT_BAND_TABLES.note, true, null);
  },

  async listActive(): Promise<BandTableDto[]> {
    return Promise.all(KINDS.map(async (k) => toDto(await this.active(k))));
  },

  async history(kind: BandTableKind): Promise<BandTableDto[]> {
    const rows = await prisma.bandTable.findMany({ where: { kind }, orderBy: { version: 'desc' } });
    return rows.map(toDto);
  },

  async update(kind: BandTableKind, body: UpdateBandTableBody, actorId: string): Promise<BandTableDto> {
    return toDto(await createVersion(kind, body.rows, body.note, false, actorId));
  },

  async reset(kind: BandTableKind, actorId: string): Promise<BandTableDto> {
    return toDto(
      await createVersion(kind, DEFAULT_BAND_TABLES.tables[kind], DEFAULT_BAND_TABLES.note, true, actorId),
    );
  },

  async byId(id: string): Promise<Row> {
    const t = await prisma.bandTable.findUnique({ where: { id } });
    if (!t) throw notFound('Bảng band');
    return t;
  },
};
