import { prisma } from '../../config/prisma';

export const adminService = {
  /** Small overview for the (Phase 1) empty admin page; proves the ADMIN-only route chain works. */
  async overview() {
    const [users, activeUsers, tests, publishedTests] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.test.count(),
      prisma.test.count({ where: { status: 'PUBLISHED' } }),
    ]);
    return { users, activeUsers, tests, publishedTests };
  },
};
