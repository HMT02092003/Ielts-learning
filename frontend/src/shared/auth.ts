// GENERATED from backend/src/shared by scripts/sync-shared.mjs — DO NOT EDIT.
import { z } from 'zod';
import { Role } from './enums';
import { Band, Uuid } from './primitives';

export const PASSWORD_MAX_LENGTH = 128;

export const LoginBody = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(256),
  remember: z.boolean().default(false),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const UserPreferences = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  examFontSize: z.enum(['sm', 'md', 'lg']).default('md'),
  timerHidden: z.boolean().default(false),
  hideWordCount: z.boolean().default(false),
  volume: z.number().int().min(0).max(100).default(80),
  dailyCardLimit: z.number().int().min(1).max(500).default(20),
  newCardsPerDay: z.number().int().min(0).max(100).default(10),
  ltLanguage: z.enum(['en-GB', 'en-US']).default('en-GB'),
});
export type UserPreferences = z.infer<typeof UserPreferences>;

/** ISO date "YYYY-MM-DD" (exam date, no time zone). */
export const IsoDate = z.iso.date();

export const UserDto = z.object({
  id: Uuid,
  email: z.string(),
  displayName: z.string(),
  role: Role,
  targetBand: Band.nullable(),
  examDate: IsoDate.nullable(),
  preferences: UserPreferences,
});
export type UserDto = z.infer<typeof UserDto>;

export const AuthResponse = z.object({
  user: UserDto,
  accessExpiresAt: z.iso.datetime(),
});
export type AuthResponse = z.infer<typeof AuthResponse>;

export const UpdateMeBody = z.strictObject({
  displayName: z.string().trim().min(1).max(80).optional(),
  targetBand: Band.nullable().optional(),
  examDate: IsoDate.nullable().optional(),
  preferences: UserPreferences.partial().optional(),
});
export type UpdateMeBody = z.infer<typeof UpdateMeBody>;

export const ChangePasswordBody = z.strictObject({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(10).max(PASSWORD_MAX_LENGTH),
});
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>;
