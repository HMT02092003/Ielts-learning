import type { Db } from '../../src/config/prisma';
import { env } from '../../src/config/env';
import { hashPassword } from '../../src/modules/auth/password';
import type { Role } from '../../src/shared/enums';

interface SeedAccount {
  email: string | undefined;
  password: string | undefined;
  name: string | undefined;
  role: Role;
}

/** Creates the admin/student accounts from env. Existing passwords are kept unless SEED_ADMIN_RESET_PASSWORD=true. */
export async function seedUsers(prisma: Db): Promise<{ adminId: string }> {
  const accounts: SeedAccount[] = [
    {
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
      name: process.env.SEED_ADMIN_NAME,
      role: 'ADMIN',
    },
    {
      email: process.env.SEED_STUDENT_EMAIL,
      password: process.env.SEED_STUDENT_PASSWORD,
      name: process.env.SEED_STUDENT_NAME,
      role: 'STUDENT',
    },
  ];
  const resetPasswords = process.env.SEED_ADMIN_RESET_PASSWORD === 'true';
  let adminId: string | undefined;

  for (const acc of accounts) {
    if (!acc.email || !acc.password) {
      if (acc.role === 'ADMIN')
        throw new Error('Thiếu SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD trong backend/.env');
      continue;
    }
    if (acc.password.length < env.PASSWORD_MIN_LENGTH) {
      throw new Error(`Mật khẩu seed của ${acc.email} phải có ít nhất ${env.PASSWORD_MIN_LENGTH} ký tự`);
    }
    const email = acc.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (resetPasswords) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash: await hashPassword(acc.password) },
        });
      }
      if (acc.role === 'ADMIN') adminId = existing.id;
      console.log(`  • user ${email} (${acc.role}) đã có${resetPasswords ? ', đã đặt lại mật khẩu' : ''}`);
      continue;
    }
    const created = await prisma.user.create({
      data: {
        email,
        displayName: acc.name ?? email,
        role: acc.role,
        passwordHash: await hashPassword(acc.password),
        ...(acc.role === 'STUDENT' ? { targetBand: 7 } : {}),
      },
    });
    if (acc.role === 'ADMIN') adminId = created.id;
    console.log(`  • đã tạo user ${email} (${acc.role})`);
  }
  if (!adminId) throw new Error('Không tạo được tài khoản admin');
  return { adminId };
}
