import { create } from 'zustand';
import { countPendingScans, countRejectedScans } from '@/db/offlineScans';

/**
 * Always-available counts of buffered scans, so a badge can show "something is
 * waiting" anywhere in the teacher app (main spec §5), not only on the
 * reconciliation screen. `pending` still needs a sync; `rejected` needs a human
 * decision (addendum §2). The tab badge shows the sum — both mean "unfinished".
 */
interface OfflineState {
  pending: number;
  rejected: number;
  online: boolean;
  refresh: () => Promise<void>;
  setOnline: (online: boolean) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  pending: 0,
  rejected: 0,
  online: true,
  refresh: async () => {
    try {
      const [pending, rejected] = await Promise.all([countPendingScans(), countRejectedScans()]);
      set({ pending, rejected });
    } catch {
      // DB not ready yet — leave the counts as-is.
    }
  },
  setOnline: (online) => set({ online }),
}));
