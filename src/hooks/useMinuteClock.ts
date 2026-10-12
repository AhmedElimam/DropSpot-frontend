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
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), periodMs);
    return () => clearInterval(id);
  }, [onScreen, periodMs]);
  return now;
}
