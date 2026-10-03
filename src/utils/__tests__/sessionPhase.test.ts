import { sessionPhase } from '../sessionPhase';

const start = new Date('2026-10-02T16:00:00+03:00').getTime();
const at = (min: number) => start + min * 60_000;
const s = (over: Partial<{ status: string; duration_minutes: number | null }> = {}) => ({
  status: 'scheduled', scheduled_at: new Date(start).toISOString(), duration_minutes: 90, ...over,
});

describe('sessionPhase', () => {
  it('is upcoming before the 30-minute early window', () => {
    expect(sessionPhase(s(), at(-31))).toBe('upcoming');
  });
  it('is live from 30 min early until start + length', () => {
    expect(sessionPhase(s(), at(-30))).toBe('live');
    expect(sessionPhase(s(), at(45))).toBe('live');
    expect(sessionPhase(s(), at(90))).toBe('live');
  });
  it('has ended after start + length even when nobody closed it', () => {
    expect(sessionPhase(s(), at(91))).toBe('done');
    expect(sessionPhase(s(), at(60 * 24))).toBe('done');
  });
  it('falls back to 60 minutes when the length is unknown', () => {
    expect(sessionPhase(s({ duration_minutes: null }), at(61))).toBe('done');
    expect(sessionPhase(s({ duration_minutes: undefined as any }), at(59))).toBe('live');
  });
  it('trusts cancelled and completed over the clock', () => {
    expect(sessionPhase(s({ status: 'cancelled' }), at(10))).toBe('cancelled');
    expect(sessionPhase(s({ status: 'completed' }), at(10))).toBe('done');
  });
});
