import Constants from 'expo-constants';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { PERSIST_MAX_AGE_MS, dropOtherDays, shouldPersistQuery } from './queryPersistRules';

/**
 * The query cache on disk. SQLite (expo-sqlite's key-value store, already in the app), not
 * AsyncStorage: Android's AsyncStorage stops at 6 MB for the WHOLE app, which the offline
 * scan buffer and roster cache share, and a big teacher's lists could fill it.
 *
 * Saved at most every 5 s and only when something in the cache changed, so a polling query
 * costs one write a minute at worst (founder 2026-10-09: no heat).
 */
const storage = new SQLiteStorage('query-cache');

export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => storage.getItemAsync(k),
    setItem: (k, v) => storage.setItemAsync(k, v),
    removeItem: async (k) => { await storage.removeItemAsync(k); },
  },
  key: 'rq-cache-v1',
  throttleTime: 5000,
  deserialize: (raw) => dropOtherDays(JSON.parse(raw)),
});

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE_MS,
  // A new app version may reshape what the screens expect: start that version clean.
  buster: Constants.expoConfig?.version ?? '0',
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
