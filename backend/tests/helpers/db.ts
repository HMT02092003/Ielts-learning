import { prisma } from '../../src/config/prisma';
import { hashPassword } from '../../src/modules/auth/password';
import type { Role } from '../../src/shared/enums';

/** Empties every table (order-independent thanks to CASCADE). Only ever runs against *_test databases. */
export async function resetDb(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export const TEST_PASSWORD = 'correct-horse-battery';

export async function createUser(opts: {
  email: string;
  role?: Role;
  isActive?: boolean;
  password?: string;
}) {
  return prisma.user.create({
    data: {
      email: opts.email,
      displayName: opts.email.split('@')[0] ?? 'user',
      role: opts.role ?? 'STUDENT',
      isActive: opts.isActive ?? true,
      passwordHash: await hashPassword(opts.password ?? TEST_PASSWORD),
    },
  });
}

export { prisma };
