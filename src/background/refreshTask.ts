import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { getQueryClient, setQueryClient } from '@/lib/queryClientRef';
import { flushPersistedQueries, persistBuster, queryPersister } from '@/lib/queryPersist';
import { PERSIST_MAX_AGE_MS, dropOtherDays, shouldPersistQuery } from '@/lib/queryPersistRules';
import { initOfflineScans } from '@/db/offlineScans';
import { initOfflineMarks } from '@/db/offlineMarks';
import { initOutbox } from '@/db/outbox';
import { runAutoSync } from '@/db/autoSync';
import { warmUpOfflineScreens } from '@/db/warmUp';
import { noteBackgroundRun } from './lastRun';

/**
 * The phone keeps itself ready while the app is closed (founder 2026-10-11: «load data or
 * sync data automatic … and cache it automatic on phone background»). The OS wakes the app
 * headless every so often — Android WorkManager, iOS BGTaskScheduler; at least
 * MINIMUM_INTERVAL_MINUTES apart, and only when IT decides (iOS mostly at night and on
 * charge; never exactly on time) — and this task:
 *
 *   1. sends what was parked offline (door scans, manual marks, the outbox — runAutoSync),
 *   2. re-downloads the screens a teacher opens most (warmUpOfflineScreens) into the same
 *      on-disk query cache the app reads when it opens with no signal.
 *
 * Only with a route out, only for a signed-in teacher or assistant, never while an admin
 * impersonates. Light by design: one pass is a dozen small requests, the week's attendance
 * sheets only on Wi-Fi (warmUp's own rule), and the OS batches it with other apps' work, so
 * it costs a phone nothing it would notice (founder 2026-10-10: no performance hit on any
 * device). Nothing here is required for the app to work: it is the same sync the app runs
 * on open, done earlier.
 *
 * Headless means no screen: the root layout has not run, so there may be no QueryClient and
 * the session is still on disk. Both are handled here, and what was fetched is written back
 * to the persisted cache the app will hydrate from.
 */
export const BACKGROUND_REFRESH_TASK = 'drosspot-background-refresh';
/** Minutes. The OS treats it as a floor (15 is its own minimum). */
export const MINIMUM_INTERVAL_MINUTES = 30;
/** One pass must stay well inside the time the OS allows (iOS gives a processing task minutes, Android ten). */
const BUDGET_MS = 50_000;

export type BackgroundRefreshOutcome = 'done' | 'skipped' | 'failed';

export async function runBackgroundRefresh(): Promise<BackgroundRefreshOutcome> {
  const net = await NetInfo.fetch().catch(() => null);
  const online = !!net?.isConnected && net.isInternetReachable !== false;
  if (!online) return 'skipped';

  // Headless start: the session is still on disk only.
  if (useAuthStore.getState().isLoading) {
    try { await useAuthStore.getState().hydrate(); } catch { return 'skipped'; }
  }
  const { isAuthenticated, role, impersonation } = useAuthStore.getState();
  if (!isAuthenticated || (role !== 'teacher' && role !== 'assistant') || impersonation?.active) return 'skipped';

  useOfflineStore.getState().setOnline(true, net?.type === 'wifi' ? 'wifi' : net?.type === 'cellular' ? 'cellular' : 'other');
  try {
    await Promise.all([initOfflineScans(), initOfflineMarks(), initOutbox()]);
  } catch {
    return 'failed';
  }

  const standalone = !getQueryClient();
  const qc = getQueryClient() ?? (await restoredClient());
  if (standalone) setQueryClient(qc);

  let finished = false;
  try {
    await Promise.race([
      (async () => {
        await runAutoSync();
        await warmUpOfflineScreens();
        finished = true;
      })(),
      new Promise<void>((resolve) => setTimeout(resolve, BUDGET_MS)),
    ]);
  } catch {
    // whatever was fetched before the failure is still worth keeping
  }
  // Headless: nothing else writes the cache to disk — do it here. In the running app the
  // persister saves on its own.
  if (standalone) await persist(qc);
  await noteBackgroundRun();
  await useOfflineStore.getState().refresh();
  return finished ? 'done' : 'failed';
}

/** A client of our own, filled from the cache on disk, so the warm-up skips what is fresh and keeps what the app had. */
async function restoredClient(): Promise<QueryClient> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, gcTime: PERSIST_MAX_AGE_MS } } });
  try {
    const saved = await queryPersister.restoreClient();
    if (saved && saved.buster === persistBuster && Date.now() - saved.timestamp < PERSIST_MAX_AGE_MS) {
      hydrate(qc, dropOtherDays(saved).clientState);
    }
  } catch {
    // an unreadable cache is an empty one
  }
  return qc;
}

async function persist(qc: QueryClient): Promise<void> {
  try {
    await queryPersister.persistClient({
      buster: persistBuster,
      timestamp: Date.now(),
      clientState: dehydrate(qc, { shouldDehydrateQuery: (q) => shouldPersistQuery(q) }),
    });
    await flushPersistedQueries(); // headless: nothing else will wait for the idle write
  } catch {
    // best-effort
  }
}

// Defined at import, before anything renders (index.js imports this file first): the OS
// may start the app headless just to run it.
TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
  const outcome = await runBackgroundRefresh().catch(() => 'failed' as const);
  return outcome === 'failed' ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
});

/** Ask the OS for the periodic wake-up. Idempotent; silent where background work is restricted. */
export async function registerBackgroundRefresh(): Promise<boolean> {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK)) return true;
    await BackgroundTask.registerTaskAsync(BACKGROUND_REFRESH_TASK, { minimumInterval: MINIMUM_INTERVAL_MINUTES });
    return true;
  } catch {
    return false;
  }
}

/** Sign-out: the phone stops waking for a session that is gone. */
export async function unregisterBackgroundRefresh(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK)) await BackgroundTask.unregisterTaskAsync(BACKGROUND_REFRESH_TASK);
  } catch {
    // nothing to undo
  }
}
