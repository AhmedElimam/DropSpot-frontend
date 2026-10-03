import { getSessionDetail } from '@/api/teacherSessions';
import { getFreshScheduleEntry } from './scheduleCache';
import { cacheSessionDetail, cachedSessionAge } from './sessionDetailCache';
import { useOfflineStore } from '@/stores/offlineStore';
import { useAuthStore, stampTeacherId } from '@/stores/authStore';

const FRESH_MS = 10 * 60 * 1000;

/**
 * Warm the last-known roster for each of today's sessions (active teacher context) so the
 * attendance sheet opens with no signal. Skips sessions cached in the last ten minutes;
 * silent on any failure. Runs after the schedule cache refresh on open/foreground.
 */
export async function prefetchTodayRosters(): Promise<void> {
  if (!useOfflineStore.getState().online) return;
  try {
    const entry = await getFreshScheduleEntry(stampTeacherId(useAuthStore.getState()));
    for (const s of entry?.sessions ?? []) {
      const age = await cachedSessionAge(s.id);
      if (age !== null && age < FRESH_MS) continue;
      try {
        await cacheSessionDetail(s.id, await getSessionDetail(s.id));
      } catch {
        // one session failing must not stop the others
      }
    }
  } catch {
    // best-effort
  }
}
