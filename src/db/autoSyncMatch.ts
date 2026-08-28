import type { TeacherSession } from '@/api/teacher';

/**
 * Pure window-matching for window-bounded auto-sync. Kept dependency-free (a type-only
 * import, erased at build) so the eligibility rule is unit-testable without pulling in
 * AsyncStorage / SQLite / the API client. The runner (autoSync.ts) composes this.
 */

// Matches the server's CARD_SCAN_BEFORE_MINUTES so an auto-attributed scan can never
// bounce as OUTSIDE_WINDOW: the server accepts [scheduled − 10m, scheduled + duration].
export const CARD_SCAN_BEFORE_MS = 10 * 60_000;

export function serverWindow(s: TeacherSession): { open: number; close: number } | null {
  if (!s.scheduled_at) return null;
  const sched = new Date(s.scheduled_at).getTime();
  if (Number.isNaN(sched)) return null;
  return { open: sched - CARD_SCAN_BEFORE_MS, close: sched + (s.duration_minutes ?? 60) * 60_000 };
}

/**
 * The session a scan auto-attributes to, or null when it's ambiguous. Eligible ONLY
 * when the captured time falls inside exactly ONE session window (§4.1): no window
 * (incl. the gap between two sessions) or two overlapping windows → null → manual.
 */
export function matchAutoSession(scannedAtMs: number, sessions: TeacherSession[]): string | null {
  const hits = sessions.filter((s) => {
    const w = serverWindow(s);
    return w !== null && scannedAtMs >= w.open && scannedAtMs <= w.close;
  });
  return hits.length === 1 ? hits[0].id : null;
}
