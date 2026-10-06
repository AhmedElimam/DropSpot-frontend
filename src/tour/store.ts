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
}

export interface TourDef { id: string; steps: TourStep[] }

interface TourState {
  targets: Record<string, TargetRect>;
  /** Bumped when the tour wants every target measured again (after a navigation). */
  measureTick: number;
  tour: TourDef | null;
  step: number;
  register: (id: string, rect: TargetRect) => void;
  unregister: (id: string) => void;
  remeasure: () => void;
  start: (tour: TourDef) => void;
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
  register: (id, rect) => {
    if (same(get().targets[id], rect)) return;
    set((s) => ({ targets: { ...s.targets, [id]: rect } }));
  },
  unregister: (id) => set((s) => {
    if (!(id in s.targets)) return s;
    const { [id]: _gone, ...rest } = s.targets;
    return { targets: rest };
  }),
  remeasure: () => set((s) => ({ measureTick: s.measureTick + 1 })),
  start: (tour) => set({ tour, step: 0 }),
  goTo: (step) => set({ step }),
  stop: () => set({ tour: null, step: 0 }),
}));

/**
 * The next step that can be shown from `from` in `dir`, or null when the tour is over. A step
 * with a target nobody registered is skipped (an assistant without the scanner, a parent with
 * no child yet); targetless cards always show.
 */
export function nextShowable(steps: TourStep[], targets: Record<string, TargetRect>, from: number, dir: 1 | -1 = 1): number | null {
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    const s = steps[i];
    if (!s.target || targets[s.target]) return i;
    // A routed step's target appears only once its screen is open: keep it and let the
    // overlay wait for the measurement (it gives up after a moment and moves on).
    if (s.route) return i;
  }
  return null;
}
