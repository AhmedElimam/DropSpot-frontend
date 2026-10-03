import { sessionPhase } from '../TodaySessionCard';
import type { SessionInstance } from '@/types/session-instance';

const at = (iso: string, extra: Partial<SessionInstance> = {}): SessionInstance => ({
  id: 1, session_schedule_id: 1, scheduled_at: iso, actual_at: null, duration_minutes: 90,
  status: 'scheduled', location: null, is_override: false, override_reason: null, ...extra,
});

describe('sessionPhase', () => {
  const now = new Date('2026-10-03T16:00:00Z').getTime();

  it('is live inside the window, with elapsed progress', () => {
    const r = sessionPhase(at('2026-10-03T15:15:00Z'), now);
    expect(r.phase).toBe('live');
    expect(r.progress).toBeCloseTo(0.5, 2);
  });

  it('is soon within the hour and later beyond it', () => {
    expect(sessionPhase(at('2026-10-03T16:20:00Z'), now)).toMatchObject({ phase: 'soon', minutesToStart: 20 });
    expect(sessionPhase(at('2026-10-03T18:00:00Z'), now).phase).toBe('later');
  });

  it('is done after the end or when completed, and cancelled wins over the clock', () => {
    expect(sessionPhase(at('2026-10-03T12:00:00Z'), now).phase).toBe('done');
    expect(sessionPhase(at('2026-10-03T18:00:00Z', { status: 'completed' }), now).phase).toBe('done');
    expect(sessionPhase(at('2026-10-03T15:30:00Z', { status: 'cancelled' }), now).phase).toBe('cancelled');
  });
});
