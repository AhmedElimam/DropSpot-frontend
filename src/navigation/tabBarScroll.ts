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

/**
 * May this page hide the bar at all? Only when it has a real amount to scroll (founder
 * 2026-10-28: «auto-detect: a page with content to scroll but not enough height must not make
 * the floating navbar dismissable») — at least MIN_EXTENT points, and at least 40% of its own
 * height. A short page keeps the bar in place: hiding it would show nothing new.
 */
export const MIN_EXTENT = 320;
export function canHide(contentHeight: number, viewportHeight: number): boolean {
  if (viewportHeight <= 0) return false;
  return contentHeight - viewportHeight >= Math.max(MIN_EXTENT, viewportHeight * 0.4);
}

/** A list's scroll: drive the bar when the page is long enough, keep it in view when it is not. */
export function reportListScroll(y: number, contentHeight: number, viewportHeight: number): void {
  if (canHide(contentHeight, viewportHeight)) reportScroll(y);
  else if (useTabBarScroll.getState().hidden) showTabBar();
}

/** A new screen or tab starts with the bar in view. */
export function showTabBar(): void {
  lastY = 0;
  useTabBarScroll.getState().set(false);
}
