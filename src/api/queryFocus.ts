/**
 * When the app returns to the foreground, which queries refetch (older-device heat, 2026-09-27).
 *
 * React Query's default refetches EVERY stale active query on every return to the app. Since
 * the AppState → focusManager wiring in app/_layout.tsx, "return to the app" really fires on a
 * phone — and a teacher at the door leaves and comes back all day (WhatsApp, a call, the
 * camera). With `staleTime` 30 s, each return after half a minute refetched every query of
 * every mounted screen at once: a burst of requests, JSON parsing and cache writes, many times
 * an hour, on the devices least able to absorb it.
 *
 * Now a return refetches only what is older than FOCUS_REFETCH_AFTER_MS. A quick glance at
 * another app costs nothing; coming back after a real break still refreshes. Opening a screen
 * is unchanged (a stale query still refetches on mount), and every list keeps pull-to-refresh.
 */
export const FOCUS_REFETCH_AFTER_MS = 2 * 60_000;

export function shouldRefetchOnFocus(dataUpdatedAt: number, now: number = Date.now()): boolean {
  // Never fetched successfully (0) → let it try.
  if (!dataUpdatedAt) return true;

  return now - dataUpdatedAt > FOCUS_REFETCH_AFTER_MS;
}

/** How often the unread-notifications badge polls while the app is open. */
export const UNREAD_POLL_MS = 2 * 60_000;
