import { weekStart, dayKey, phasesByDay, dotPhases } from '../sessionDays';

describe('sessionDays', () => {
  it('starts the week on Saturday', () => {
    // 2026-10-02 is a Friday → its week began Saturday 2026-09-26.
    expect(dayKey(weekStart(new Date(2026, 9, 2)))).toBe('2026-09-26');
    expect(dayKey(weekStart(new Date(2026, 8, 26)))).toBe('2026-09-26');
  });

  it('buckets sessions by day with their phase now', () => {
    const now = new Date(2026, 9, 2, 12, 0).getTime();
    const at = (h: number, day = 2) => new Date(2026, 9, day, h, 0).toISOString();
    const m = phasesByDay([
      { status: 'scheduled', scheduled_at: at(9), duration_minutes: 60, date: '2026-10-02' },
      { status: 'scheduled', scheduled_at: at(12), duration_minutes: 60, date: '2026-10-02' },
      { status: 'scheduled', scheduled_at: at(18), duration_minutes: 60, date: '2026-10-02' },
      { status: 'cancelled', scheduled_at: at(10, 3), duration_minutes: 60, date: '2026-10-03' },
    ], now);
    expect(m.get('2026-10-02')).toEqual(['done', 'live', 'upcoming']);
    expect(m.get('2026-10-03')).toEqual(['cancelled']);
    expect(dotPhases(m.get('2026-10-02'))).toEqual(['live', 'upcoming', 'done']);
  });
});
