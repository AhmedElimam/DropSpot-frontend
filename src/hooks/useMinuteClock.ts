import { useEffect, useState } from 'react';
import { useOnScreen } from './useAmbientMotion';

/**
 * Re-render once a minute so countdowns and live / upcoming / ended stay true on screen — only
 * while the screen is in front of you. A hidden tab or a backgrounded app no longer re-renders
 * every minute; coming back sets the time at once (founder 2026-10-09: «light on all devices»).
 */
export function useMinuteClock(periodMs = 60_000): number {
  const onScreen = useOnScreen();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!onScreen) return;
    // Coming back inside the same period keeps the value it had: the screen is already
    // right, and a fresh number would re-render the whole tab on every switch (measured
    // 2026-10-16: Home and Sessions rendered twice per tab press).
    setNow((prev) => (Math.floor(Date.now() / periodMs) === Math.floor(prev / periodMs) ? prev : Date.now()));
    const id = setInterval(() => setNow(Date.now()), periodMs);
    return () => clearInterval(id);
  }, [onScreen, periodMs]);
  return now;
}
