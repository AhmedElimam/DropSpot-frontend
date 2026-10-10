import { weekWindow, weekStart, addDays, dayKey } from '../sessionDays';

describe('weekWindow', () => {
  it('is the Saturday–Friday week, exactly as the sessions tab asks for it', () => {
    // Saturday 2026-10-10 starts its own week.
    expect(weekWindow(new Date(2026, 9, 10, 9))).toEqual({ from: '2026-10-10', to: '2026-10-16' });
    // Friday 2026-10-16 still belongs to it; Saturday 10-17 starts the next.
    expect(weekWindow(new Date(2026, 9, 16, 23, 30))).toEqual({ from: '2026-10-10', to: '2026-10-16' });
    expect(weekWindow(new Date(2026, 9, 17, 0, 5))).toEqual({ from: '2026-10-17', to: '2026-10-23' });
  });

  it('matches the tab’s own arithmetic (warm-up must hit the same cache key)', () => {
    for (let i = 0; i < 14; i++) {
      const d = addDays(new Date(2026, 9, 1, 12), i);
      const start = weekStart(d);
      expect(weekWindow(d)).toEqual({ from: dayKey(start), to: dayKey(addDays(start, 6)) });
    }
  });
});
