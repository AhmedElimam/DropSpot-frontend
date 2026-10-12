import { create } from 'zustand';
import type { Href } from 'expo-router';

/** Where a spotlit element sits, in window coordinates. */
export interface TargetRect { x: number; y: number; width: number; height: number }

/**
 * One stop of the tour. `target` names a `<TourTarget id>` somewhere on screen; a step whose
 * target is not on screen is skipped, so one script serves a teacher and an assistant who
 * sees fewer buttons. `route` is opened before the step so the screen behind the spotlight
 * is the one being explained. Without a target the step is a centred card (welcome, done).
 */
export interface TourStep {
  target?: string;
  route?: Href;
  /** i18n keys. */
  title: string;
  body: string;
  /** The centred card's button label key (welcome / done cards). */
  cta?: string;
  /** Where the card's button goes (the done card's «أنشئ مقررك»); the tour ends first. */
  href?: Href;
  /** Roles this step is not for (an assistant does not create courses). */
  notFor?: string[];
}

export interface TourDef {
  id: string;
  steps: TourStep[];
  /** Who presents the tour on its cards. 'rose' = مدام روز, the teacher side's guide (founder 2026-10-07). */
  narrator?: 'rose';
}

/** The focused screen's scroll view, so a step can bring its target into view. */
export interface TourScroller { scrollBy: (dy: number) => void }

interface TourState {
  targets: Record<string, TargetRect>;
  /** Bumped when the tour wants every target measured again (after a navigation). */
  measureTick: number;
  tour: TourDef | null;
  step: number;
  /** The first tour, the server's call: it cannot be skipped. A replay can. */
  mandatory: boolean;
  /** The scroll view of the screen in focus (a home screen), with the token of who set it. */
  scroller: { owner: object; api: TourScroller } | null;
  setScroller: (owner: object, api: TourScroller) => void;
  clearScroller: (owner: object) => void;
  register: (id: string, rect: TargetRect) => void;
  /**
   * While the tour scrolls a target into view, it puts the target where the scroll will
   * leave it at once (so the spotlight glides there with the page) and ignores the target's
   * own mid-scroll measurements until `ms` have passed.
   */
  pin: (id: string, rect: TargetRect, ms: number) => void;
  pinned: { id: string; until: number } | null;
  unregister: (id: string) => void;
  remeasure: () => void;
  start: (tour: TourDef, opts?: { mandatory?: boolean }) => void;
  goTo: (step: number) => void;
  stop: () => void;
}

const same = (a: TargetRect | undefined, b: TargetRect) =>
  !!a && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

export const useTourStore = create<TourState>((set, get) => ({
  targets: {},
  measureTick: 0,
  tour: null,
  step: 0,
  mandatory: false,
  scroller: null,
  setScroller: (owner, api) => set({ scroller: { owner, api } }),
  // Only the screen that set it may clear it: a blur that lands after the next focus must
  // not wipe the new screen's scroller.
  clearScroller: (owner) => { if (get().scroller?.owner === owner) set({ scroller: null }); },
  pinned: null,
  pin: (id, rect, ms) => set((s) => ({ targets: { ...s.targets, [id]: rect }, pinned: { id, until: Date.now() + ms } })),
  register: (id, rect) => {
    const p = get().pinned;
    if (p && p.id === id && Date.now() < p.until) return;
    if (same(get().targets[id], rect)) return;
    set((s) => ({ targets: { ...s.targets, [id]: rect } }));
  },
  unregister: (id) => set((s) => {
    if (!(id in s.targets)) return s;
    const { [id]: _gone, ...rest } = s.targets;
    return { targets: rest };
  }),
  remeasure: () => set((s) => ({ measureTick: s.measureTick + 1 })),
  start: (tour, opts) => set({ tour, step: 0, mandatory: !!opts?.mandatory }),
  goTo: (step) => set({ step }),
  stop: () => set({ tour: null, step: 0, mandatory: false }),
}));

/**
 * The screen a step belongs on: its own route, or the last route set before it. Most of a
 * screen's stops name no route (they ride on the first one that opened it), so stepping BACK
 * into them from another tab used to leave the wrong page up — and spotlight a target that
 * only looked present because its tab stays mounted underneath (founder 2026-10-09).
 */
export function routeFor(steps: TourStep[], index: number): TourStep['route'] {
  for (let i = index; i >= 0; i--) {
    if (steps[i]?.route) return steps[i].route;
  }
  return undefined;
}

/**
 * The next step that can be shown from `from` in `dir`, or null when the tour is over. A step
 * with a target nobody registered is skipped (an assistant without the scanner, a parent with
 * no child yet); targetless cards always show.
 */
export function nextShowable(steps: TourStep[], targets: Record<string, TargetRect>, from: number, dir: 1 | -1 = 1, role?: string | null): number | null {
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    const s = steps[i];
    if (role && s.notFor?.includes(role)) continue;
    if (!s.target || targets[s.target]) return i;
    // A routed step's target appears only once its screen is open: keep it and let the
    // overlay wait for the measurement (it gives up after a moment and moves on).
    if (s.route) return i;
  }
  return null;
}
