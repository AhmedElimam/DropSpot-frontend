import { getTeacherStudents, getTeacherCourses } from '@/api/students';
import { getPendingCollections } from '@/api/pendingCollections';
import { getRoseSheet } from '@/api/cash';
import { getTeacherSessions, getSessionDetail, type SessionsPage } from '@/api/teacherSessions';
import { weekWindow, dayKey } from '@/utils/sessionDays';
import { cacheSessionDetail, cachedSessionAge } from './sessionDetailCache';
import { getQueryClient } from '@/lib/queryClientRef';
import { useOfflineStore } from '@/stores/offlineStore';

const FRESH_MS = 10 * 60 * 1000;
/** A session's attendance sheet saved within this long is not fetched again. */
const DETAIL_FRESH_MS = 30 * 60 * 1000;
/** At most this many sheets per pass — a week of a busy teacher, newest first. */
const DETAIL_CAP = 20;

/**
 * Warm the screens a teacher opens most — the students list, the groups, the collections
 * roster and مدام روز's sheet — so they open with no signal even if never visited since
 * the last launch (the cache on disk, src/lib/queryPersist.ts, keeps what is fetched here).
 * Four requests, one after the other, skipped when fetched in the last ten minutes, then
 * this week's sessions (warmUpSessions); runs
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
  await warmUpSessions();
}

/**
 * The «الحصص» tab with no signal (founder 2026-10-10: «on the session page it doesn't save
 * data for offline mode»): this week's list under the very key the tab asks for, then the
 * attendance sheet of every session from the start of the week up to today — newest first,
 * cancelled ones skipped, each at most once every 30 min (today's are also warmed by
 * prefetchTodayRosters). Sequential, silent on failure.
 */
async function warmUpSessions(): Promise<void> {
  const qc = getQueryClient();
  if (!qc || !useOfflineStore.getState().online) return;
  const today = new Date();
  const { from, to } = weekWindow(today);
  let page: SessionsPage | undefined;
  try {
    page = await qc.fetchQuery({
      queryKey: ['teacher-session-history', 'window', from, to],
      queryFn: () => getTeacherSessions({ from, to }),
      staleTime: FRESH_MS,
    });
  } catch {
    return;
  }
  const todayKey = dayKey(today);
  const due = (page?.items ?? [])
    .filter((s) => s.status !== 'cancelled' && (s.date ?? (s.scheduled_at ? dayKey(new Date(s.scheduled_at)) : '')) <= todayKey)
    .sort((a, b) => String(b.scheduled_at ?? b.date ?? '').localeCompare(String(a.scheduled_at ?? a.date ?? '')))
    .slice(0, DETAIL_CAP);
  for (const s of due) {
    if (!useOfflineStore.getState().online) return;
    const age = await cachedSessionAge(s.id);
    if (age !== null && age < DETAIL_FRESH_MS) continue;
    try {
      await cacheSessionDetail(s.id, await getSessionDetail(s.id));
    } catch {
      // one session failing must not stop the others
    }
  }
}
