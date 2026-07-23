import { create } from 'zustand';
import { countPendingScans } from '@/db/offlineScans';

/**
 * Always-available count of unsynced buffered scans, so a badge can show
 * "something is waiting to sync" anywhere in the teacher app (main spec §5),
 * not only on the reconciliation screen.
 */
interface OfflineState {
  pending: number;
  refresh: () => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  pending: 0,
  refresh: async () => {
    try {
      set({ pending: await countPendingScans() });
    } catch {
      // DB not ready yet — leave the count as-is.
    }
  },
}));
