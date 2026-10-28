import { create } from 'zustand';
import type { FeatureTermsDoc } from '@/config/defaults';

/**
 * Which feature agreement is on screen, and which were put off («لاحقًا») for this session.
 *
 * A due agreement opens by itself once (when the feature arrives); «لاحقًا» puts it off for the
 * session — the feature stays closed on the server (423) until accepted, and touching it opens
 * the agreement again (`open(key)`: an entry point, or the API client on a 423).
 */
interface State {
  /** Put off for this session. */
  later: string[];
  /** Asked for explicitly (an entry point, a 423): shown even if put off. */
  asked: string | null;
  /**
   * The agreement ON SCREEN. It stays until accepted or put off: a 423 from a second feature
   * while it is up only waits its turn (2026-10-28: three agreements asked at once replaced one
   * another mid-presentation — each dismissed the other and the app froze).
   */
  current: string | null;
  open: (key: string) => void;
  /** The prompt shows this one now. */
  showing: (key: string) => void;
  putOff: (key: string) => void;
  done: (key: string) => void;
  reset: () => void;
}

export const useFeatureTermsStore = create<State>((set, get) => ({
  later: [],
  asked: null,
  current: null,
  // Asking again for what is already on screen changes nothing; asking for another one while an
  // agreement is up only queues it as the next (the one on screen keeps its place).
  open: (key) => { if (get().asked !== key && get().current !== key) set({ asked: key }); },
  showing: (key) => { if (get().current !== key) set({ current: key }); },
  putOff: (key) => set({ later: Array.from(new Set([...get().later, key])), asked: get().asked === key ? null : get().asked, current: get().current === key ? null : get().current }),
  done: (key) => set({ later: get().later.filter((k) => k !== key), asked: get().asked === key ? null : get().asked, current: get().current === key ? null : get().current }),
  reset: () => set({ later: [], asked: null, current: null }),
}));

/**
 * The agreement to show now: the one already on screen while it is still due, else the one asked
 * for (an entry point, a 423) if it is still due, else the first due one not put off this
 * session. Null = nothing on screen.
 */
export function pickFeatureTerms(due: FeatureTermsDoc[], later: string[], asked: string | null, current: string | null = null): FeatureTermsDoc | null {
  if (current) {
    const shown = due.find((d) => d.key === current);
    if (shown) return shown;
  }
  if (asked) {
    const one = due.find((d) => d.key === asked);
    if (one) return one;
  }
  return due.find((d) => !later.includes(d.key)) ?? null;
}
