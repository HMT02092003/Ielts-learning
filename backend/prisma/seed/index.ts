// `pnpm db:seed` (prisma db seed). Idempotent: safe to run again at any time.
import { AppError } from '../../src/lib/errors';
import { prisma } from '../../src/config/prisma';
import { seedDummyTests } from './content';
import { seedUsers } from './users';

async function main() {
  console.log('Seed: tài khoản');
  const { adminId } = await seedUsers(prisma);
  console.log('Seed: đề mẫu (dummy)');
  await seedDummyTests(prisma, adminId);
  console.log('Seed xong.');
}

main()
  .catch((err: unknown) => {
    if (err instanceof AppError) console.error(err.message, JSON.stringify(err.details, null, 2));
    else console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
