import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { AppError, notFound } from '../../lib/errors';
import type {
  CreateUserBody,
  ListUsersQuery,
  Paginated,
  ResetPasswordBody,
  UpdateUserBody,
  UserAdminDto,
} from '../../shared/admin';
import { hashPassword } from '../auth/password';
import { authService } from '../auth/auth.service';
import { toIsoDate } from '../auth/user.mapper';

const select = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  targetBand: true,
  examDate: true,
  lastLoginAt: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

type Row = Prisma.UserGetPayload<{ select: typeof select }>;

function toDto(u: Row): UserAdminDto {
  return {
    ...u,
    examDate: toIsoDate(u.examDate),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

const isoToDate = (d: string | null | undefined) =>
  d === undefined ? undefined : d === null ? null : new Date(`${d}T00:00:00Z`);

export const usersService = {
  async list(q: ListUsersQuery): Promise<Paginated<UserAdminDto>> {
    const where: Prisma.UserWhereInput = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.isActive === undefined ? {} : { isActive: q.isActive }),
      ...(q.q
        ? {
            OR: [
              { email: { contains: q.q, mode: 'insensitive' } },
              { displayName: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select,
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return { items: rows.map(toDto), page: q.page, pageSize: q.pageSize, total };
  },

  async get(id: string): Promise<UserAdminDto> {
    const u = await prisma.user.findUnique({ where: { id }, select });
    if (!u) throw notFound('Tài khoản');
    return toDto(u);
  },

  async create(body: CreateUserBody): Promise<UserAdminDto> {
    const exists = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (exists) throw new AppError('CONFLICT', 'Email đã được dùng cho một tài khoản khác');
    const u = await prisma.user.create({
      data: {
        email: body.email,
        displayName: body.displayName,
        role: body.role,
        passwordHash: await hashPassword(body.password),
        targetBand: body.targetBand ?? null,
        examDate: isoToDate(body.examDate) ?? null,
      },
      select,
    });
    return toDto(u);
  },

  /** Demoting/deactivating the last active admin (incl. yourself) is refused: someone must be able to log in. */
  async update(actorId: string, id: string, body: UpdateUserBody): Promise<UserAdminDto> {
    const current = await prisma.user.findUnique({ where: { id }, select });
    if (!current) throw notFound('Tài khoản');
    const losesAdmin =
      current.role === 'ADMIN' &&
      current.isActive &&
      ((body.role !== undefined && body.role !== 'ADMIN') || body.isActive === false);
    if (losesAdmin) {
      const otherAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: id } },
      });
      if (otherAdmins === 0)
        throw new AppError('LAST_ADMIN', 'Không thể bỏ quyền hoặc khóa quản trị viên cuối cùng');
      if (id === actorId && body.isActive === false) {
        throw new AppError('LAST_ADMIN', 'Không thể tự khóa tài khoản của chính mình');
      }
    }
    const u = await prisma.user.update({
      where: { id },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.targetBand !== undefined ? { targetBand: body.targetBand } : {}),
        ...(body.examDate !== undefined ? { examDate: isoToDate(body.examDate) } : {}),
      },
      select,
    });
    if (body.isActive === false) await authService.logoutAll(id);
    return toDto(u);
  },

  async resetPassword(id: string, body: ResetPasswordBody): Promise<void> {
    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('Tài khoản');
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(body.newPassword) } });
    await authService.logoutAll(id);
  },
};
