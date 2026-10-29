import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from './env';

export function createPrismaClient(databaseUrl: string = env.DATABASE_URL) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    // passwordHash never leaves the DB layer unless a service explicitly opts in with omit: { passwordHash: false }.
    omit: { user: { passwordHash: true } },
  });
}

export type Db = ReturnType<typeof createPrismaClient>;

export const prisma: Db = createPrismaClient();
