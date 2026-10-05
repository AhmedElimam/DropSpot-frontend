export type SessionPhase = 'live' | 'upcoming' | 'done' | 'cancelled';

const EARLY_MIN = 30;

/**
 * Where a session stands now, from its status and its own clock: live from 30 min before
 * the start until start + length (60 when unknown); after that it has ended even when
 * nobody closed it. Used by the cards AND the session sheet so the two never disagree.
 */
export function sessionPhase(
  s: { status: string; scheduled_at: string | null; duration_minutes?: number | null },
  now: number,
): SessionPhase {
  if (s.status === 'cancelled') return 'cancelled';
  if (s.status === 'completed') return 'done';
  if (!s.scheduled_at) return 'upcoming';
  const start = new Date(s.scheduled_at).getTime();
  if (Number.isNaN(start)) return 'upcoming';
  const end = start + (s.duration_minutes ?? 60) * 60_000;
  if (now >= start - EARLY_MIN * 60_000 && now <= end) return 'live';
  return now > end ? 'done' : 'upcoming';
}
