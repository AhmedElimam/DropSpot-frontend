import { notifyManager } from '@tanstack/react-query';

/**
 * «A stall in the middle of the back animation» (founder 2026-10-08, 10-12, 10-20, 10-23).
 *
 * A screen transition is drawn natively, but JS work landing in its ~350 ms still drops
 * frames: every React commit mounts views on the main thread, between the animation's frames.
 * The thaw of a frozen screen (fixed 10-08/10-12) and مدام روز's typing (fixed 10-20) were two
 * such commits; the general ones are (1) a server answer arriving while a page slides — the
 * page you just opened and swipe back from is usually still loading, and its data renders the
 * whole page mid-swipe — and (2) the screen underneath waking up at the pop: focus flips,
 * ambient motion and polls start, the home re-renders, all inside the animation.
 *
 * This is the one signal both lean on. Every native stack reports its transitions here
 * (`transitionListeners`, a navigator prop in all six Stacks); while one is in flight:
 *   - React Query holds its observer notifications and flushes them at the end, so no query
 *     result re-renders a sliding page (`installTransitionScheduler`);
 *   - `useOnScreen` answers false, so ambient motion, clocks and polls wait for the end.
 * A transition that never reports its end (a deep link, a replace) expires on its own.
 *
 * A swipe back is different (founder 2026-10-23: «it stalls when my finger touches something
 * clickable during the swipe»): it lasts as long as the finger is held, and a slow, resting
 * swipe outlived the cap — everything held then landed at once under the finger. A swipe
 * takes the finger's touch from React Native as it begins (react-native-screens cancels JS
 * touches, so a button under the finger never fires), so a transition that starts within
 * moments of a cancelled touch is the finger's: it holds until the swipe finishes or is let
 * go (`transitionEnd` / `gestureCancel`), with only a far cap. The root view reports its
 * cancelled touches (`noteTouchCancel`).
 */

/** No native transition is longer; after this the flag clears on its own. */
export const TRANSITION_MAX_MS = 900;
/** A swipe follows the finger: its cap is only for a swipe whose end never comes. */
export const SWIPE_MAX_MS = 8000;
/** A touch cancelled this close to a transition's start was taken by that transition's swipe. */
export const SWIPE_LINK_MS = 350;

let active = false;
let until = 0;
let expiry: ReturnType<typeof setTimeout> | null = null;
let startedAt = -Infinity;
let cancelledAt = -Infinity;
const listeners = new Set<() => void>();
const now = () => Date.now();

/** `active` is the hold as subscribers were told it; `until` guards against a late timer. */
export function inTransition(): boolean {
  return active && now() < until;
}

function notify(): void {
  listeners.forEach((l) => l());
}

function hold(ms: number): void {
  until = now() + ms;
  if (expiry) clearTimeout(expiry);
  expiry = setTimeout(settle, ms);
}

/** A transition has started (or is still running): hold until it ends, or until the cap. */
export function markTransition(): void {
  const was = inTransition();
  active = true;
  startedAt = now();
  hold(now() - cancelledAt <= SWIPE_LINK_MS ? SWIPE_MAX_MS : TRANSITION_MAX_MS);
  if (!was) notify();
}

/** The root view's `onTouchCancel`: a touch was taken away — by a swipe back, if one starts now. */
export function noteTouchCancel(): void {
  cancelledAt = now();
  // The swipe's start may have been reported first.
  if (inTransition() && cancelledAt - startedAt <= SWIPE_LINK_MS) hold(SWIPE_MAX_MS);
}

/** The transition ended, was cancelled, or hit the cap: release everything that waited. */
export function settle(): void {
  if (expiry) { clearTimeout(expiry); expiry = null; }
  const was = active;
  active = false;
  until = 0;
  if (was) notify();
  flush();
}

export function subscribeTransitions(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * For a navigator's `screenListeners`: the native stack's own events. `transitionStart` fires
 * for both the leaving and the arriving screen (and again when a cancelled swipe settles
 * back), `transitionEnd` when either is done; `gestureCancel` when a swipe back is let go.
 */
export const transitionListeners = {
  transitionStart: () => markTransition(),
  transitionEnd: () => settle(),
  gestureCancel: () => settle(),
};

// ── React Query ───────────────────────────────────────────────────────────────────────────
const held: (() => void)[] = [];

function flush(): void {
  if (held.length === 0) return;
  const batch = held.splice(0);
  batch.forEach((cb) => cb());
}

/**
 * React Query flushes observer notifications through a scheduler (`setTimeout(cb, 0)` by
 * default). This one keeps them while a transition runs and lets them go the moment it ends —
 * a query that resolves under a sliding page renders it once the page has landed. Mutations
 * are unaffected: their callbacks run on the mutation's own promise.
 */
export function installTransitionScheduler(): void {
  notifyManager.setScheduler((cb) => {
    if (inTransition()) { held.push(cb); return; }
    setTimeout(cb, 0);
  });
}

/** Tests only. */
export function _resetTransitions(): void {
  active = false;
  until = 0;
  startedAt = -Infinity;
  cancelledAt = -Infinity;
  if (expiry) { clearTimeout(expiry); expiry = null; }
  held.splice(0);
  listeners.clear();
}
