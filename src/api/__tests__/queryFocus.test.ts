/**
 * Returning to the app refreshes only data older than 2 minutes (src/api/queryFocus.ts), and
 * the unread badge polls every 2 minutes — the burst of refetches on every return, many times
 * an hour at the door, was a heat source on entry-level Android phones.
 */
import { shouldRefetchOnFocus, FOCUS_REFETCH_AFTER_MS, UNREAD_POLL_MS } from '../queryFocus';

describe('shouldRefetchOnFocus', () => {
  const now = 1_800_000_000_000;

  it('skips data refreshed within the last 2 minutes (a quick glance at another app)', () => {
    expect(FOCUS_REFETCH_AFTER_MS).toBe(120_000);
    expect(shouldRefetchOnFocus(now - 30_000, now)).toBe(false);
    expect(shouldRefetchOnFocus(now - FOCUS_REFETCH_AFTER_MS, now)).toBe(false);
  });

  it('refreshes data older than that (coming back after a real break)', () => {
    expect(shouldRefetchOnFocus(now - FOCUS_REFETCH_AFTER_MS - 1, now)).toBe(true);
    expect(shouldRefetchOnFocus(now - 10 * 60_000, now)).toBe(true);
  });

  it('always lets a query that never succeeded try again', () => {
    expect(shouldRefetchOnFocus(0, now)).toBe(true);
  });

  it('polls the unread badge every 2 minutes, not every 30 seconds', () => {
    expect(UNREAD_POLL_MS).toBe(120_000);
  });
});
