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
  open: (key: string) => void;
  putOff: (key: string) => void;
  done: (key: string) => void;
  reset: () => void;
}

export const useFeatureTermsStore = create<State>((set, get) => ({
  later: [],
  asked: null,
  open: (key) => set({ asked: key }),
  putOff: (key) => set({ later: Array.from(new Set([...get().later, key])), asked: get().asked === key ? null : get().asked }),
  done: (key) => set({ later: get().later.filter((k) => k !== key), asked: get().asked === key ? null : get().asked }),
  reset: () => set({ later: [], asked: null }),
}));

/**
 * The agreement to show now: the one asked for (an entry point, a 423) if it is still due,
 * else the first due one not put off this session. Null = nothing on screen.
 */
export function pickFeatureTerms(due: FeatureTermsDoc[], later: string[], asked: string | null): FeatureTermsDoc | null {
  if (asked) {
    const one = due.find((d) => d.key === asked);
    if (one) return one;
  }
  return due.find((d) => !later.includes(d.key)) ?? null;
}
