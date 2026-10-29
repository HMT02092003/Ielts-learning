import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { systemClock, type Clock } from '../../lib/clock';
import { AppError } from '../../lib/errors';
import type { ChangePasswordBody, LoginBody, UpdateMeBody, UserDto } from '../../shared/auth';
import type { Role } from '../../shared/enums';
import { hashPassword, passwordNeedsRehash, verifyAgainstDummy, verifyPassword } from './password';
import { hashRefreshToken, newRefreshToken, signAccessToken } from './token.service';
import { toUserDto } from './user.mapper';

const DAY_MS = 86_400_000;

export interface IssuedSession {
  user: UserDto;
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  /** undefined → session cookies (not "remembered"). */
  cookieMaxAgeMs: number | undefined;
}

const invalidCredentials = () => new AppError('AUTH_INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
const invalidRefresh = () =>
  new AppError('AUTH_REFRESH_INVALID', 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại');

export function createAuthService(clock: Clock = systemClock) {
  async function issue(
    user: Parameters<typeof toUserDto>[0],
    family: { familyId: string; familyExpiresAt: Date; persistent: boolean },
  ): Promise<IssuedSession> {
    const now = clock.now();
    const expiresAt = new Date(
      Math.min(now.getTime() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS, family.familyExpiresAt.getTime()),
    );
    const refresh = newRefreshToken();
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: refresh.hash, expiresAt, ...family },
    });
    const access = signAccessToken({ sub: user.id, role: user.role }, now);
    return {
      user: toUserDto(user),
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      cookieMaxAgeMs: family.persistent ? expiresAt.getTime() - now.getTime() : undefined,
    };
  }

  return {
    async login(body: LoginBody): Promise<IssuedSession> {
      const user = await prisma.user.findUnique({
        where: { email: body.email },
        omit: { passwordHash: false },
      });
      if (!user) {
        await verifyAgainstDummy(body.password);
        throw invalidCredentials();
      }
      if (!(await verifyPassword(user.passwordHash, body.password))) throw invalidCredentials();
      if (!user.isActive) throw new AppError('AUTH_ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa');

      const now = clock.now();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: now,
          ...(passwordNeedsRehash(user.passwordHash)
            ? { passwordHash: await hashPassword(body.password) }
            : {}),
        },
      });
      return issue(user, {
        familyId: randomUUID(),
        familyExpiresAt: new Date(now.getTime() + env.REFRESH_FAMILY_MAX_DAYS * DAY_MS),
        persistent: body.remember,
      });
    },

    /** Rotate a refresh token. A token rotated within the grace window gets a sibling (two tabs refreshing at once). */
    async refresh(rawToken: string | undefined): Promise<IssuedSession> {
      if (!rawToken) throw invalidRefresh();
      const tokenHash = hashRefreshToken(rawToken);
      for (let attempt = 0; attempt < 2; attempt++) {
        const row = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
        const now = clock.now();
        if (
          !row ||
          row.revokedAt ||
          row.expiresAt <= now ||
          row.familyExpiresAt <= now ||
          !row.user.isActive
        ) {
          throw invalidRefresh();
        }
        const family = {
          familyId: row.familyId,
          familyExpiresAt: row.familyExpiresAt,
          persistent: row.persistent,
        };
        if (row.rotatedAt) {
          if (now.getTime() - row.rotatedAt.getTime() <= env.REFRESH_ROTATION_GRACE_SECONDS * 1000) {
            return issue(row.user, family);
          }
          throw invalidRefresh();
        }
        const claimed = await prisma.refreshToken.updateMany({
          where: { id: row.id, rotatedAt: null },
          data: { rotatedAt: now },
        });
        if (claimed.count === 1) return issue(row.user, family);
        // Lost a race with another request: re-read and take the grace path.
      }
      throw invalidRefresh();
    },

    async logout(rawToken: string | undefined): Promise<void> {
      if (!rawToken) return;
      const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(rawToken) } });
      if (!row) return;
      await prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: clock.now() },
      });
    },

    async logoutAll(userId: string): Promise<void> {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: clock.now() },
      });
    },

    /** Used by `authenticate`: the access JWT alone does not tell us the account was deactivated. */
    async getActiveUser(userId: string): Promise<{ id: string; role: Role } | null> {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true },
      });
      return user?.isActive ? { id: user.id, role: user.role } : null;
    },

    async me(userId: string): Promise<UserDto> {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ');
      return toUserDto(user);
    },

    async updateMe(userId: string, body: UpdateMeBody): Promise<UserDto> {
      const current = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
      if (!current) throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ');
      const stored = current.preferences;
      const prevPrefs = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
          ...(body.targetBand !== undefined ? { targetBand: body.targetBand } : {}),
          ...(body.examDate !== undefined
            ? { examDate: body.examDate ? new Date(`${body.examDate}T00:00:00Z`) : null }
            : {}),
          ...(body.preferences ? { preferences: { ...prevPrefs, ...body.preferences } } : {}),
        },
      });
      return toUserDto(user);
    },

    /** Revokes every other session of the user; the current family stays signed in. */
    async changePassword(
      userId: string,
      body: ChangePasswordBody,
      currentRefresh: string | undefined,
    ): Promise<void> {
      if (body.newPassword.length < env.PASSWORD_MIN_LENGTH) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Mật khẩu mới phải có ít nhất ${env.PASSWORD_MIN_LENGTH} ký tự`,
        );
      }
      const user = await prisma.user.findUnique({ where: { id: userId }, omit: { passwordHash: false } });
      if (!user || !(await verifyPassword(user.passwordHash, body.currentPassword))) {
        throw new AppError('AUTH_INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng');
      }
      const current = currentRefresh
        ? await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(currentRefresh) } })
        : null;
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { passwordHash: await hashPassword(body.newPassword) },
        }),
        prisma.refreshToken.updateMany({
          where: { userId, revokedAt: null, ...(current ? { familyId: { not: current.familyId } } : {}) },
          data: { revokedAt: clock.now() },
        }),
      ]);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
export const authService = createAuthService();
