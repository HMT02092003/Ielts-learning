// Empties a TEST database before an e2e run. Refuses to touch any database whose name does not end with _test.
// Usage: DATABASE_URL=<…_test> node --import tsx prisma/seed/reset-test-db.ts
import { prisma } from '../../src/config/prisma';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) throw new Error(`Từ chối xóa dữ liệu database "${name}" (chỉ cho *_test)`);
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length > 0) {
    const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  console.log(`Đã làm trống ${rows.length} bảng trong ${name}.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
