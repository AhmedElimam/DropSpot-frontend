import { getTeacherStudents, getTeacherCourses } from '@/api/students';
import { getPendingCollections } from '@/api/pendingCollections';
import { getRoseSheet } from '@/api/cash';
import { getQueryClient } from '@/lib/queryClientRef';
import { useOfflineStore } from '@/stores/offlineStore';

const FRESH_MS = 10 * 60 * 1000;

/**
 * Warm the screens a teacher opens most — the students list, the groups, the collections
 * roster and مدام روز's sheet — so they open with no signal even if never visited since
 * the last launch (the cache on disk, src/lib/queryPersist.ts, keeps what is fetched here).
 * Four requests, one after the other, skipped when fetched in the last ten minutes; runs
 * with the schedule refresh on open and every ten minutes of foreground returns. Silent on
 * any failure (an assistant without the ability simply gets a 403 that nothing shows).
 */
export async function warmUpOfflineScreens(): Promise<void> {
  const qc = getQueryClient();
  if (!qc || !useOfflineStore.getState().online) return;
  const jobs: Array<{ key: unknown[]; fn: () => Promise<unknown> }> = [
    { key: ['teacher-students', null, ''], fn: () => getTeacherStudents(undefined) },
    { key: ['teacher-courses'], fn: getTeacherCourses },
    { key: ['pending-collections'], fn: getPendingCollections },
    { key: ['rose-sheet'], fn: getRoseSheet },
  ];
  for (const j of jobs) {
    if (!useOfflineStore.getState().online) return;
    try {
      await qc.prefetchQuery({ queryKey: j.key, queryFn: j.fn, staleTime: FRESH_MS });
    } catch {
      // one failing must not stop the others
    }
  }
}
