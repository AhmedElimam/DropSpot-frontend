import { isVersionBelow } from '@/utils/semver';

/** How long «بعدين» keeps the popup away for the same store version. */
export const UPDATE_PROMPT_SNOOZE_MS = 24 * 60 * 60 * 1000;

export const UPDATE_PROMPT_STORAGE_KEY = 'update_prompt.snoozed';

export interface UpdateSnooze { version: string; at: number }

/** Who speaks: مدام روز to the people who run the lesson, الناظر to the families. */
export function updatePromptVoice(role: string | null | undefined): 'rose' | 'nazer' | null {
  if (role === 'teacher' || role === 'assistant') return 'rose';
  if (role === 'student' || role === 'parent') return 'nazer';
  return null;
}

/**
 * Is this phone asked to update? Only when the server named a newer version on this phone's
 * store, the binary is below it — and NOT below the floor: there the blocking screen speaks.
 */
export function updateOffered(binary: string, latest: string | null | undefined, min: string | null | undefined): boolean {
  if (!latest || !/^\d+\.\d+\.\d+$/.test(latest)) return false;
  if (min && isVersionBelow(binary, min)) return false;
  return isVersionBelow(binary, latest);
}

/** «بعدين» holds for a day and only for the version it was said to — a newer one asks again. */
export function updateSnoozed(snooze: UpdateSnooze | null, latest: string, now: number): boolean {
  return !!snooze && snooze.version === latest && now - snooze.at < UPDATE_PROMPT_SNOOZE_MS;
}

export function parseSnooze(raw: string | null): UpdateSnooze | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<UpdateSnooze>;
    return typeof v?.version === 'string' && typeof v?.at === 'number' ? { version: v.version, at: v.at } : null;
  } catch {
    return null;
  }
}
