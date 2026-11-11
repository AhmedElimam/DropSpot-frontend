import { create } from 'zustand';
import type { IncomingShare } from '../../modules/drosspot-share/src';

/** The receipt another app shared into Dros Spot, held for the send screen (2026-11-11). */
export const useIncomingShare = create<{ share: IncomingShare | null; set: (s: IncomingShare | null) => void }>((set) => ({
  share: null,
  set: (share) => set({ share }),
}));
