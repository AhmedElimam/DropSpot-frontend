import { create } from 'zustand';
import { countPendingScans, countRejectedScans } from '@/db/offlineScans';
import { countPendingMarks, countRejectedMarks } from '@/db/offlineMarks';
import { countPendingActions, countRejectedActions } from '@/db/outbox';

/**
 * Always-available counts of buffered scans, so a badge can show "something is
 * waiting" anywhere in the teacher app (main spec §5), not only on the
 * reconciliation screen. `pending` still needs a sync; `rejected` needs a human
 * decision (addendum §2). The tab badge shows the sum — both mean "unfinished".
 */
interface OfflineState {
  pending: number;
  rejected: number;
  /** NetInfo's word: an interface with a route out (the teacher layout keeps it current). */
  online: boolean;
  /** What the link is: the heavy warm-up (a week of attendance sheets) runs on Wi-Fi only. */
  link: 'wifi' | 'cellular' | 'other';
  /**
   * The link is there but requests are dropping: set by the API client when one gets no
   * answer, cleared by the next answer or after WEAK_MS. While weak, queueable actions are
   * parked at once instead of each waiting out its 15 s (a bad connection, not a dead one,
   * is what a demo venue has — founder 2026-10-10).
   */
  weak: boolean;
  /** The last action parked offline — the pill at the top tells the person it is saved. */
  lastQueued: { label: string; at: number } | null;
  /** A sync pass is sending right now (the header indicator turns its arrows meanwhile). */
  syncing: boolean;
  /** When the last sync pass finished talking to the server (ms), for «آخر مزامنة». */
  lastSyncAt: number | null;
  // How many scans window-bounded auto-sync has uploaded since the teacher last
  // dismissed the notice (§7). Accumulates across runs; shown as a dismissible
  // passive confirmation. The records are audit-logged regardless, so dismissing
  // loses nothing.
  autoSynced: number;
  refresh: () => Promise<void>;
  setOnline: (online: boolean, link?: 'wifi' | 'cellular' | 'other') => void;
  noteNetworkFailure: () => void;
  noteNetworkOk: () => void;
  noteQueued: (label: string) => void;
  setSyncing: (syncing: boolean, finishedOk?: boolean) => void;
  bumpAutoSynced: (n: number) => void;
  dismissAutoSynced: () => void;
}

export const WEAK_MS = 30_000;
let weakTimer: ReturnType<typeof setTimeout> | null = null;

export const useOfflineStore = create<OfflineState>((set, get) => ({
  pending: 0,
  rejected: 0,
  online: true,
  link: 'other',
  weak: false,
  lastQueued: null,
  syncing: false,
  lastSyncAt: null,
  autoSynced: 0,
  refresh: async () => {
    try {
      // Scans, manual marks AND parked actions: all "something on this phone is not on the server yet".
      const [ps, rs, pm, rm, pa, ra] = await Promise.all([
        countPendingScans(), countRejectedScans(),
        countPendingMarks().catch(() => 0), countRejectedMarks().catch(() => 0),
        countPendingActions().catch(() => 0), countRejectedActions().catch(() => 0),
      ]);
      set({ pending: ps + pm + pa, rejected: rs + rm + ra });
    } catch {
      // DB not ready yet — leave the counts as-is.
    }
  },
  setOnline: (online, link) => set(link ? { online, link } : { online }),
  noteNetworkFailure: () => {
    if (weakTimer) clearTimeout(weakTimer);
    weakTimer = setTimeout(() => { weakTimer = null; set({ weak: false }); }, WEAK_MS);
    if (!get().weak) set({ weak: true });
  },
  noteNetworkOk: () => {
    if (weakTimer) { clearTimeout(weakTimer); weakTimer = null; }
    if (get().weak) set({ weak: false });
  },
  noteQueued: (label) => set((s) => ({ lastQueued: { label, at: Date.now() }, pending: s.pending + 1 })),
  setSyncing: (syncing, finishedOk) => set(finishedOk ? { syncing, lastSyncAt: Date.now() } : { syncing }),
  bumpAutoSynced: (n) => set((s) => ({ autoSynced: s.autoSynced + n })),
  dismissAutoSynced: () => set({ autoSynced: 0 }),
}));
