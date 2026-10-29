import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { Role } from '../../shared/enums';

const AccessClaims = z.object({ sub: z.uuid(), role: Role });
export type AccessClaims = z.infer<typeof AccessClaims>;

export function signAccessToken(claims: AccessClaims, now: Date): { token: string; expiresAt: Date } {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + env.ACCESS_TOKEN_TTL_SECONDS;
  const token = jwt.sign({ role: claims.role, iat, exp }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: claims.sub,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    jwtid: randomUUID(),
  });
  return { token, expiresAt: new Date(exp * 1000) };
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    const parsed = AccessClaims.safeParse(payload);
    if (!parsed.success) throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ');
    return parsed.data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError)
      throw new AppError('AUTH_TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn');
    throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ');
  }
}

/** Opaque refresh token: only the sha256 is stored in the DB. */
export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
