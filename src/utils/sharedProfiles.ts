import type { StudentProfileEntry } from '@/types/user';

/**
 * Siblings on one phone (founder 2026-11-19). A student's own number is his login, so a
 * brother with no phone of his own is linked to it: one password (the phone holder's), a
 * picker after login «مين بيستخدم التطبيق دلوقتي؟», and a switcher on the home and profile.
 *
 * Pure helpers only — the screens, the API and the remembered choice live elsewhere.
 */

/** The list as the server sent it, or empty for anything that is not a list. */
export function profileList(profiles: readonly StudentProfileEntry[] | null | undefined): StudentProfileEntry[] {
  return Array.isArray(profiles) ? profiles.filter((p) => p && typeof p.user_id === 'number') : [];
}

/** Two students or more on this phone. Empty / one = not shared: everything as before. */
export function isSharedPhone(profiles: readonly StudentProfileEntry[] | null | undefined): boolean {
  return profileList(profiles).length >= 2;
}

/**
 * Show the picker? Only for a STUDENT session, only right after a fresh sign-in (the
 * `pending` flag a login sets — never on a cold start with a stored session), and only
 * when the phone is shared.
 */
export function shouldShowProfilePicker(args: {
  role: string | null | undefined;
  pending: boolean;
  profiles: readonly StudentProfileEntry[] | null | undefined;
}): boolean {
  return args.role === 'student' && args.pending && isSharedPhone(args.profiles);
}

/** The phone holder — the key the remembered choice is stored under. Falls back to the lowest id. */
export function phoneHolderId(profiles: readonly StudentProfileEntry[] | null | undefined): number | null {
  const list = profileList(profiles);
  if (list.length === 0) return null;
  const holder = list.find((p) => p.holds_phone);
  if (holder) return holder.user_id;

  return list.reduce((min, p) => (p.user_id < min ? p.user_id : min), list[0].user_id);
}

/** The profile this session is signed in as: `is_current`, else the user id, else the first. */
export function currentProfile(
  profiles: readonly StudentProfileEntry[] | null | undefined,
  userId?: number | null,
): StudentProfileEntry | null {
  const list = profileList(profiles);
  return list.find((p) => p.is_current) ?? list.find((p) => p.user_id === userId) ?? list[0] ?? null;
}

/** The phone holder first, then the others in the server's order. */
export function orderProfiles(profiles: readonly StudentProfileEntry[] | null | undefined): StudentProfileEntry[] {
  const list = profileList(profiles);
  return [...list.filter((p) => p.holds_phone), ...list.filter((p) => !p.holds_phone)];
}

/**
 * Which card the picker pre-highlights: the one chosen last time on this phone when it is
 * still on the list, else the profile the login signed in as.
 */
export function highlightedProfileId(
  profiles: readonly StudentProfileEntry[] | null | undefined,
  remembered: number | null | undefined,
  userId?: number | null,
): number | null {
  const list = profileList(profiles);
  if (remembered != null && list.some((p) => p.user_id === remembered)) return remembered;

  return currentProfile(list, userId)?.user_id ?? null;
}

/** The short name a chip shows: the server's first name, else the first word of the name. */
export function profileFirstName(p: Pick<StudentProfileEntry, 'name' | 'first_name'> | null | undefined): string {
  const first = (p?.first_name ?? '').trim();
  if (first) return first;

  return (p?.name ?? '').trim().split(/\s+/)[0] ?? '';
}

/** The quiet line under a name: code · grade (whichever exist). */
export function profileSubtitle(p: Pick<StudentProfileEntry, 'student_code' | 'grade'>): string {
  return [p.student_code, p.grade].map((x) => (x ?? '').trim()).filter(Boolean).join(' · ');
}

/** The AsyncStorage key for the choice remembered on this phone, per phone holder. */
export function rememberedProfileKey(holderId: number): string {
  return `shared_phone_choice_${holderId}`;
}

/** What tapping a profile does: nothing to switch when it is the one already signed in. */
export function pickAction(target: Pick<StudentProfileEntry, 'user_id' | 'is_current'>, userId?: number | null): 'continue' | 'switch' {
  return target.is_current || target.user_id === userId ? 'continue' : 'switch';
}

/** Teacher's student page: the one line about a shared number, or null. */
export type SharedPhoneInfo = { role: 'holder' | 'sibling'; with: { name: string; student_code?: string | null }[] } | null | undefined;

export function sharedPhoneLine(info: SharedPhoneInfo, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  if (!info || !Array.isArray(info.with) || info.with.length === 0) return null;
  const names = info.with.map((w) => (w?.name ?? '').trim()).filter(Boolean);
  if (names.length === 0) return null;
  if (info.role === 'sibling') return t('student_profile_ui.shared_phone_sibling', { name: names[0] });

  return t('student_profile_ui.shared_phone_holder', { names: names.join('، ') });
}
