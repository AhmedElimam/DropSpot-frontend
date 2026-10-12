import { configRule } from '@/stores/appConfigStore';
import { router, type Href } from 'expo-router';
import type { TeacherSession } from '@/api/teacher';

// The "current" HIGHLIGHT window — a UI convenience only. A session lights up 30 min
// before its start through its scheduled end. DELIBERATELY separate from the backend
// check-in validation window (10 min before / 15 after); the two must never reference
// each other (spec Directive 3).
/** A backend rule (/admin/config → session_early_min), read at call time. */
const HIGHLIGHT_BEFORE_MIN = () => configRule('session_early_min');

export function isSessionHighlighted(s: TeacherSession, now: number): boolean {
  if (!s.scheduled_at) return false;
  const start = new Date(s.scheduled_at).getTime();
  if (Number.isNaN(start)) return false;
  const end = start + (s.duration_minutes ?? 60) * 60_000;
  return now >= start - HIGHLIGHT_BEFORE_MIN() * 60_000 && now <= end;
}

/**
 * A private lesson (course attendance_mode 'none', founder 2026-10-12) has no attendance at
 * all, so it can never be a scan target. A missing field is an older server: a door course.
 */
export function isScannableSession(s: Pick<TeacherSession, 'tracks_attendance'>): boolean {
  return s.tracks_attendance !== false;
}

/**
 * The session that is live now, else the next one still to come today, else null.
 * With `{ scannable: true }` a private lesson is never picked — use that when the answer
 * becomes a scan target; the Home spotlight shows any session (a private one draws its label).
 */
export function pickCurrentSession(sessions: TeacherSession[], now: number, opts: { scannable?: boolean } = {}): TeacherSession | null {
  const pool = opts.scannable ? sessions.filter(isScannableSession) : sessions;
  const live = pool.find((s) => isSessionHighlighted(s, now));
  if (live) return live;
  const upcoming = pool
    .filter((s) => s.scheduled_at && new Date(s.scheduled_at).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  return upcoming[0] ?? null;
}

/** The session a scan should land in now — never a private lesson. */
export function pickScanSession(sessions: TeacherSession[], now: number): TeacherSession | null {
  return pickCurrentSession(sessions, now, { scannable: true });
}

/** Opens the scanner on this session. A private lesson has nothing to scan: no-op, returns false. */
export function goToScan(session: TeacherSession): boolean {
  if (!isScannableSession(session)) return false;
  router.push(`/(teacher)/scan?name=${encodeURIComponent(session.course_name ?? '')}&id=${session.id}` as Href);
  return true;
}
