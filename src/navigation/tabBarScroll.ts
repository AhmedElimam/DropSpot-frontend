import { create } from 'zustand';

/**
 * The floating tab bar hides on a scroll down and comes back on a scroll up (founder
 * 2026-10-28: «on scroll down dismiss with animation like Facebook»). Every scrolling screen
 * reports through the shared Refreshable wrapper; the bar reads one boolean. A list at its
 * top always shows the bar, so a screen never opens with it gone.
 */
const THRESHOLD = 12;
let lastY = 0;

export const useTabBarScroll = create<{ hidden: boolean; set: (hidden: boolean) => void }>((set) => ({
  hidden: false,
  set: (hidden) => set((s) => (s.hidden === hidden ? s : { hidden })),
}));

/** Feed a vertical scroll offset; decides show / hide from the direction, with a small dead band. */
export function reportScroll(y: number): void {
  const { hidden, set } = useTabBarScroll.getState();
  if (y <= 0) { lastY = 0; if (hidden) set(false); return; }
  const dy = y - lastY;
  if (dy > THRESHOLD) { lastY = y; if (!hidden) set(true); }
  else if (dy < -THRESHOLD) { lastY = y; if (hidden) set(false); }
}

/** A new screen or tab starts with the bar in view. */
export function showTabBar(): void {
  lastY = 0;
  useTabBarScroll.getState().set(false);
}
