/**
 * The date/number helpers were changed to REUSE cached Intl formatters instead of
 * calling `toLocaleDateString`/`toLocaleTimeString` (which construct a fresh formatter
 * on every call — the single most expensive JS operation in a list row on Hermes/
 * Android, and a measured cause of scroll jank and heat: Redmi Note 11S, 2026-09-22).
 *
 * Caching is only safe if the OUTPUT is unchanged, so every case below asserts the new
 * implementation against a freshly-constructed formatter with the same options — the
 * exact call the old code made. If a future edit drops the Cairo timezone pin or the
 * locale, these fail.
 */
import {
  formatTime, formatDate, formatShortDate, formatDateTime,
  formatDayDate, formatNumber, timeAgo,
} from '../format';

const LOCALE = 'ar-EG';
const TZ = 'Africa/Cairo';

// Spread across months, a DST-free zone, midnight/noon and both halves of the day.
const SAMPLES = [
  '2026-01-01T00:00:00Z', '2026-03-15T12:30:00Z', '2026-06-30T23:59:00Z',
  '2026-08-12T16:30:00Z', '2026-09-22T06:05:00Z', '2026-12-31T21:00:00Z',
];

describe('format helpers keep their exact output while caching formatters', () => {
  it.each(SAMPLES)('formatTime(%s)', (iso) => {
    const expected = new Date(iso).toLocaleTimeString(LOCALE, {
      timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true,
    });
    expect(formatTime(iso)).toBe(expected);
  });

  it.each(SAMPLES)('formatDate(%s)', (iso) => {
    const expected = new Date(iso).toLocaleDateString(LOCALE, {
      timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
    });
    expect(formatDate(iso)).toBe(expected);
    expect(formatDayDate(iso)).toBe(expected); // same shape, shared cache entry
  });

  it.each(SAMPLES)('formatShortDate(%s)', (iso) => {
    const expected = new Date(iso).toLocaleDateString(LOCALE, {
      timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short',
    });
    expect(formatShortDate(iso)).toBe(expected);
  });

  it.each(SAMPLES)('formatDateTime(%s)', (iso) => {
    const expected = new Date(iso).toLocaleString(LOCALE, {
      timeZone: TZ, day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
    expect(formatDateTime(iso)).toBe(expected);
  });

  it('formatDate/formatDateTime still honour caller overrides', () => {
    const iso = '2026-08-12T16:30:00Z';
    expect(formatDate(iso, { year: 'numeric' })).toBe(
      new Date(iso).toLocaleDateString(LOCALE, {
        timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }),
    );
    expect(formatDateTime(iso, { month: 'long' })).toBe(
      new Date(iso).toLocaleString(LOCALE, {
        timeZone: TZ, day: 'numeric', month: 'long',
        hour: 'numeric', minute: '2-digit', hour12: true,
      }),
    );
  });

  it('formatNumber matches toLocaleString, with and without options', () => {
    expect(formatNumber(1234567)).toBe((1234567).toLocaleString(LOCALE));
    expect(formatNumber(1234.5, { minimumFractionDigits: 2 })).toBe(
      (1234.5).toLocaleString(LOCALE, { minimumFractionDigits: 2 }),
    );
  });

  it('a repeated call returns the same string (cache cannot drift)', () => {
    const iso = '2026-09-22T06:05:00Z';
    expect(formatTime(iso)).toBe(formatTime(iso));
    expect(formatDate(iso)).toBe(formatDate(iso));
  });

  it('an invalid date yields an empty string rather than "Invalid Date"', () => {
    for (const fn of [formatTime, formatDate, formatShortDate, formatDateTime, formatDayDate]) {
      expect(fn('not-a-date')).toBe('');
    }
  });

  it('timeAgo falls back to a formatted date beyond 30 days', () => {
    const old = new Date(Date.now() - 400 * 86400000);
    expect(timeAgo(old)).toBe(
      old.toLocaleDateString(LOCALE, { timeZone: TZ, day: 'numeric', month: 'short' }),
    );
  });
});
