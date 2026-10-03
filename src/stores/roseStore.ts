import { create } from 'zustand';

/**
 * The teacher's «مدام روز» name switch, as last reported by the server (cash settings
 * ride on every cash payload — src/api/cash.ts keeps this current). Default: named, so a
 * screen never flips from generic to named after the first load for the common case.
 */
interface RoseState {
  named: boolean;
  setNamed: (named: boolean) => void;
}

export const useRoseStore = create<RoseState>()((set) => ({
  named: true,
  setNamed: (named) => set({ named }),
}));
