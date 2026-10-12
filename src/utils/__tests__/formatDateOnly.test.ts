import { formatDate, formatDateOnly } from '../format';

// The student's teacher page showed «الثلاثاء ٧ أكتوبر» inside a 48pt day tile, because
// formatDate merges its options into weekday + day + month (founder 2026-10-06).
describe('formatDateOnly', () => {
  const d = new Date('2026-10-07T16:00:00');

  it('gives only the day number for a date tile', () => {
    const day = formatDateOnly(d, { day: 'numeric' });
    expect(day).toMatch(/^[٠-٩0-9]{1,2}$/);
    expect(day.length).toBeLessThan(formatDate(d, { day: 'numeric' }).length);
  });

  it('gives only the month, or only the weekday, when that is all that is asked', () => {
    expect(formatDateOnly(d, { month: 'short' })).not.toMatch(/[٠-٩0-9]/);
    expect(formatDateOnly(d, { weekday: 'long' })).not.toMatch(/[٠-٩0-9]/);
  });

  it('is empty for an invalid date', () => {
    expect(formatDateOnly('not a date', { day: 'numeric' })).toBe('');
  });
});
