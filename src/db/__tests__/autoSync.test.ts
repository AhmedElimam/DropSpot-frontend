import { matchAutoSession } from '../autoSyncMatch';
import type { TeacherSession } from '@/api/teacher';

function session(id: string, scheduledAt: string, duration = 60): TeacherSession {
  return {
    id, course_name: null, scheduled_at: scheduledAt, time: null,
    duration_minutes: duration, location: null, status: 'scheduled', is_current: false,
  };
}
const ms = (iso: string) => new Date(iso).getTime();

// Server accept window = [scheduled − 10min, scheduled + duration].
describe('matchAutoSession — window-bounded auto-sync eligibility (§4.1)', () => {
  const a = session('A', '2026-08-27T16:00:00Z', 60); // window 15:50 … 17:00
  const b = session('B', '2026-08-27T18:00:00Z', 60); // window 17:50 … 19:00

  it('matches when the scan falls inside exactly ONE window', () => {
    expect(matchAutoSession(ms('2026-08-27T16:05:00Z'), [a, b])).toBe('A');
  });

  it('is null BETWEEN sessions (no window) — never assigned to the nearest', () => {
    // 17:10: after A closes (17:00), before B opens (17:50) — belongs to neither.
    expect(matchAutoSession(ms('2026-08-27T17:10:00Z'), [a, b])).toBeNull();
  });

  it('is null when two windows OVERLAP (back-to-back sessions)', () => {
    const bOverlap = session('B', '2026-08-27T16:30:00Z', 60); // window 16:20 … 17:30
    // 16:40 is inside both A (…17:00) and bOverlap (16:20…) → ambiguous → manual.
    expect(matchAutoSession(ms('2026-08-27T16:40:00Z'), [a, bOverlap])).toBeNull();
  });

  it('includes the 10-min pre-window and the full duration, exclusive outside', () => {
    expect(matchAutoSession(ms('2026-08-27T15:50:00Z'), [a])).toBe('A');   // exactly open
    expect(matchAutoSession(ms('2026-08-27T15:49:00Z'), [a])).toBeNull();  // 1 min before open
    expect(matchAutoSession(ms('2026-08-27T17:00:00Z'), [a])).toBe('A');   // exactly close (sched+60)
    expect(matchAutoSession(ms('2026-08-27T17:01:00Z'), [a])).toBeNull();  // 1 min after close
  });

  it('is null with no cached sessions', () => {
    expect(matchAutoSession(ms('2026-08-27T16:05:00Z'), [])).toBeNull();
  });

  it('ignores sessions with an unparseable scheduled_at', () => {
    const bad = session('X', 'not-a-date', 60);
    expect(matchAutoSession(ms('2026-08-27T16:05:00Z'), [bad, a])).toBe('A');
  });
});
