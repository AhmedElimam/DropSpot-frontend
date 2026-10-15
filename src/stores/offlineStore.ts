import { create } from 'zustand';
import { countPendingScans, countRejectedScans } from '@/db/offlineScans';
import { countPendingMarks, countRejectedMarks } from '@/db/offlineMarks';
import { countPendingActions, countRejectedActions } from '@/db/outbox';
import type { PendingByKind } from '@/utils/connectionState';

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
  /** When the last sync pass finished talking to the server (ms), for «آخر مزامنة». Kept on disk across launches. */
  lastSyncAt: number | null;
  /** The last sync pass failed (the server refused it or did not answer) — said on the indicator, not swallowed. */
  lastSyncFailedAt: number | null;
  /** What `pending` is made of, so the indicator can say WHAT is waiting, not just how many. */
  pendingByKind: PendingByKind;
  /**
   * Did OUR SERVER answer? (founder 2026-10-12: «it doesn't raise any flag».) The phone's
   * network says nothing about it: Wi-Fi can be perfect while the API is down. Every answer
   * the API client gets stamps `serverOkAt`; a request with no answer or a 5xx counts a
   * failure in a row, reset by the next answer.
   */
  serverOkAt: number | null;
  serverFailures: number;
  /** When this launch started — the «data is getting old» rule waits this long before its first verdict. */
  launchedAt: number;
  noteServerOk: () => void;
  noteServerFailure: () => void;
  /** Read `lastSyncAt` back from disk at launch. */
  hydrateSyncStamp: () => Promise<void>;
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
  lastSyncFailedAt: null,
  pendingByKind: { scans: 0, marks: 0, actions: 0 },
  serverOkAt: null,
  serverFailures: 0,
  launchedAt: Date.now(),
  autoSynced: 0,
  refresh: async () => {
    try {
      // Scans, manual marks AND parked actions: all "something on this phone is not on the server yet".
      const [ps, rs, pm, rm, pa, ra] = await Promise.all([
        countPendingScans(), countRejectedScans(),
        countPendingMarks().catch(() => 0), countRejectedMarks().catch(() => 0),
        countPendingActions().catch(() => 0), countRejectedActions().catch(() => 0),
      ]);
      set({ pending: ps + pm + pa, rejected: rs + rm + ra, pendingByKind: { scans: ps, marks: pm, actions: pa } });
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
  setSyncing: (syncing, finishedOk) => {
    if (syncing) { set({ syncing }); return; }
    if (finishedOk) {
      const at = Date.now();
      set({ syncing, lastSyncAt: at, lastSyncFailedAt: null });
      void saveSyncStamp(at);
    } else {
      // A pass that ended badly is a flag, not a silence.
      set({ syncing, lastSyncFailedAt: Date.now() });
    }
  },
  noteServerOk: () => {
    const s = get();
    // One write a second at most: every answer passes through here.
    const now = Date.now();
    if (s.serverFailures !== 0 || !s.serverOkAt || now - s.serverOkAt > 1000) set({ serverOkAt: now, serverFailures: 0 });
  },
  noteServerFailure: () => set((s) => ({ serverFailures: s.serverFailures + 1 })),
  hydrateSyncStamp: async () => {
    const at = await readSyncStamp();
    if (at && (!get().lastSyncAt || at > (get().lastSyncAt ?? 0))) set({ lastSyncAt: at });
  },
  bumpAutoSynced: (n) => set((s) => ({ autoSynced: s.autoSynced + n })),
  dismissAutoSynced: () => set({ autoSynced: 0 }),
}));

// «آخر مزامنة» survives a restart: it used to read «لم تتم بعد» after every launch, which made
// the indicator look like it had never done anything. Its own little kv store, lazy-required
// so tests and headless tasks that import the store never load the native module.
const SYNC_KEY = 'sync:lastAt';
function metaStore(): { getItemAsync(k: string): Promise<string | null>; setItemAsync(k: string, v: string): Promise<void> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SQLiteStorage } = require('expo-sqlite/kv-store') as typeof import('expo-sqlite/kv-store');
    return new SQLiteStorage('app-meta');
  } catch {
    return null;
  }
}
async function saveSyncStamp(at: number): Promise<void> {
  try { await metaStore()?.setItemAsync(SYNC_KEY, String(at)); } catch { /* best-effort */ }
}
async function readSyncStamp(): Promise<number | null> {
  try {
    const v = await metaStore()?.getItemAsync(SYNC_KEY);
    const n = Number(v);
    return v && Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
