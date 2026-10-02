import { colors } from '@/theme/index';
import { sessionPhase, type SessionPhase } from '@/utils/sessionPhase';

export const DAY_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
/** Saturday-first column order for a calendar grid (JS getDay values). */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** The Egyptian week starts on Saturday. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() + 1) % 7));
}

type PhaseInput = { status: string; scheduled_at: string | null; duration_minutes?: number | null; date?: string | null };

/** Sessions bucketed by local day, each with its phase now — what the day markers draw. */
export function phasesByDay(items: PhaseInput[], now: number): Map<string, SessionPhase[]> {
  const m = new Map<string, SessionPhase[]>();
  for (const s of items) {
    const k = s.date ?? (s.scheduled_at ? dayKey(new Date(s.scheduled_at)) : '');
    if (!k) continue;
    const list = m.get(k) ?? [];
    list.push(sessionPhase(s, now));
    m.set(k, list);
  }
  return m;
}

// Same meaning as the session cards' stripe: live green, upcoming indigo (apricot on the
// dark header, where indigo would vanish), ended grey, cancelled red.
export const PHASE_DOT: Record<'light' | 'dark', Record<SessionPhase, string>> = {
  light: { live: colors.success, upcoming: colors.brand, done: colors.textTertiary, cancelled: colors.danger },
  dark: { live: '#4ADE9B', upcoming: colors.accent, done: 'rgba(255,255,255,0.45)', cancelled: '#FF7A8A' },
};

/** Order the dots so the most pressing state shows first. */
const RANK: Record<SessionPhase, number> = { live: 0, upcoming: 1, done: 2, cancelled: 3 };
export function dotPhases(phases: SessionPhase[] | undefined): SessionPhase[] {
  return (phases ?? []).slice().sort((a, b) => RANK[a] - RANK[b]);
}
