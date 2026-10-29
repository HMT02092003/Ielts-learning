import { UserPreferences, type UserDto } from '../../shared/auth';
import type { Role } from '../../shared/enums';

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  targetBand: number | null;
  examDate: Date | null;
  preferences: unknown;
}

/** @db.Date comes back as UTC midnight → "YYYY-MM-DD". */
export const toIsoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function toUserDto(u: UserRow): UserDto {
  const prefs = UserPreferences.safeParse(u.preferences ?? {});
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    targetBand: u.targetBand,
    examDate: toIsoDate(u.examDate),
    // Unknown/legacy keys must never break login: fall back to defaults.
    preferences: prefs.success ? prefs.data : UserPreferences.parse({}),
  };
}
