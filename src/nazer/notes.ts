import type { SessionNoteEntry } from '@/api/sessionNotes';
import type { FreshNote } from './mood';

const FRESH_MS = 48 * 3_600_000;

/**
 * What الناظر keeps on his desk from the session notes: the newest three, how many were
 * written in the last 48 hours, and the newest one for his line of the day.
 */
export function latestNotes(items: SessionNoteEntry[], now: Date = new Date()): { top: SessionNoteEntry[]; fresh: number; latest: FreshNote | null } {
  const sorted = [...items].sort((a, b) => (b.written_at ?? '').localeCompare(a.written_at ?? ''));
  const fresh = sorted.filter((e) => e.written_at && now.getTime() - new Date(e.written_at).getTime() < FRESH_MS).length;
  const first = sorted[0];
  return {
    top: sorted.slice(0, 3),
    fresh,
    latest: first ? { teacher_name: first.teacher_name, course_name: first.course_name, written_at: first.written_at } : null,
  };
}
