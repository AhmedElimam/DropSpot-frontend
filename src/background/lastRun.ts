import { SQLiteStorage } from 'expo-sqlite/kv-store';

/**
 * When the background refresh (refreshTask.ts) last finished a pass, so the sync screen can
 * say «آخر تحديث تلقائي في الخلفية: ٣:١٠ م». Its own little store: the query cache's store is
 * owned by the persister and may be wiped at sign-out.
 */
const store = new SQLiteStorage('app-meta');
const KEY = 'bg:lastRun';

export async function noteBackgroundRun(at: number = Date.now()): Promise<void> {
  try { await store.setItemAsync(KEY, String(at)); } catch { /* best-effort */ }
}

export async function backgroundLastRun(): Promise<number | null> {
  try {
    const v = await store.getItemAsync(KEY);
    const n = Number(v);
    return v && Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
