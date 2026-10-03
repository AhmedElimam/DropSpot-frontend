import { router, type Href } from 'expo-router';
import type { TeacherSession } from '@/api/teacher';

// The "current" HIGHLIGHT window — a UI convenience only. A session lights up 30 min
// before its start through its scheduled end. DELIBERATELY separate from the backend
// check-in validation window (10 min before / 15 after); the two must never reference
// each other (spec Directive 3).
const HIGHLIGHT_BEFORE_MIN = 30;

export function isSessionHighlighted(s: TeacherSession, now: number): boolean {
  if (!s.scheduled_at) return false;
  const start = new Date(s.scheduled_at).getTime();
  if (Number.isNaN(start)) return false;
  const end = start + (s.duration_minutes ?? 60) * 60_000;
  return now >= start - HIGHLIGHT_BEFORE_MIN * 60_000 && now <= end;
}

/** The session that is live now, else the next one still to come today, else null. */
export function pickCurrentSession(sessions: TeacherSession[], now: number): TeacherSession | null {
  const live = sessions.find((s) => isSessionHighlighted(s, now));
  if (live) return live;
  const upcoming = sessions
    .filter((s) => s.scheduled_at && new Date(s.scheduled_at).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  return upcoming[0] ?? null;
}

export function goToScan(session: TeacherSession) {
  router.push(`/(teacher)/scan?name=${encodeURIComponent(session.course_name ?? '')}&id=${session.id}` as Href);
}
