import Constants from 'expo-constants';
import { AppState, InteractionManager } from 'react-native';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { PERSIST_MAX_AGE_MS, dropOtherDays, shouldPersistQuery } from './queryPersistRules';

/**
 * The query cache on disk. SQLite (expo-sqlite's key-value store, already in the app), not
 * AsyncStorage: Android's AsyncStorage stops at 6 MB for the WHOLE app, which the offline
 * scan buffer and roster cache share, and a big teacher's lists could fill it.
 *
 * WHEN it writes matters more than where (founder 2026-10-11: «a slight delay on every tap,
 * on every device»). The stock persister serialised the whole cache on the JS thread every
 * 5 s while anything changed — and on the home something always changes (polls, warm-ups) —
 * so a tap landing on that JSON.stringify waited for it. This persister keeps the latest
 * snapshot and writes it only when the phone is idle: after any running interaction or
 * animation, at most once per WRITE_EVERY_MS, and at once when the app goes to the
 * background (the one moment a crash could lose something). The cache is a copy of the
 * server; losing the last half-minute of it costs one refetch.
 */
const storage = new SQLiteStorage('query-cache');
const KEY = 'rq-cache-v1';
/** Quiet-time floor between two writes while the app is in front. */
export const WRITE_EVERY_MS = 30_000;

let pending: PersistedClient | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastWriteAt = 0;
let writing: Promise<void> | null = null;

async function writeNow(): Promise<void> {
  const client = pending;
  pending = null;
  if (timer) { clearTimeout(timer); timer = null; }
  if (!client) return;
  lastWriteAt = Date.now();
  try {
    await storage.setItemAsync(KEY, JSON.stringify(client));
  } catch {
    // disk full / store closed — the next snapshot tries again
  }
}

/** Serialise only once the phone has nothing better to do, and never twice in WRITE_EVERY_MS. */
function scheduleWrite(): void {
  if (timer) return;
  const wait = Math.max(0, WRITE_EVERY_MS - (Date.now() - lastWriteAt));
  timer = setTimeout(() => {
    timer = null;
    InteractionManager.runAfterInteractions(() => { writing = writeNow(); });
  }, wait);
}

/** Going to the background: write what is pending right away (no interaction is running). */
AppState.addEventListener('change', (state) => {
  if (state !== 'active' && pending) { writing = writeNow(); }
});

export const queryPersister: Persister = {
  persistClient: (client) => { pending = client; scheduleWrite(); },
  restoreClient: async () => {
    const raw = await storage.getItemAsync(KEY);
    if (!raw) return undefined;
    try { return dropOtherDays(JSON.parse(raw) as PersistedClient); } catch { return undefined; }
  },
  removeClient: async () => {
    pending = null;
    if (timer) { clearTimeout(timer); timer = null; }
    await storage.removeItemAsync(KEY);
  },
};

/** Tests and the background task: the pending snapshot, written now. */
export async function flushPersistedQueries(): Promise<void> {
  await writeNow();
  await writing;
}

/** A new app version may reshape what the screens expect: start that version clean. (The background refresh writes with the same stamp.) */
export const persistBuster = Constants.expoConfig?.version ?? '0';

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE_MS,
  buster: persistBuster,
  dehydrateOptions: { shouldDehydrateQuery: (q) => shouldPersistQuery(q) },
};

/** Sign-out: the next person on this phone must never see the last one's data. */
export async function forgetPersistedQueries(): Promise<void> {
  try {
    await queryPersister.removeClient();
  } catch {
    // best-effort — the next sign-in clears the in-memory cache anyway
  }
}
