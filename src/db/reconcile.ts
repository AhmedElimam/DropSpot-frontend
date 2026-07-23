import type { TeacherSession, OfflineScanResult } from '@/api/teacher';
import { deleteScans, markScanFailed } from './offlineScans';
import type { ScanBucket } from './buckets';

const HALF_HOUR_MS = 30 * 60_000;

/** Sessions whose window (30 min before → scheduled end) contains the bucket start. */
function matchingSessions(bucket: ScanBucket, sessions: TeacherSession[]): TeacherSession[] {
  const start = new Date(bucket.startTime).getTime();
  return sessions.filter((s) => {
    if (!s.scheduled_at) return false;
    const sched = new Date(s.scheduled_at).getTime();
    if (Number.isNaN(sched)) return false;
    const open = sched - HALF_HOUR_MS;
    const close = sched + (s.duration_minutes ?? 60) * 60_000;
    return start >= open && start <= close;
  });
}

/** First plausible session for a bucket — used to PRE-SELECT an obvious match on
 *  the reconciliation screen so the teacher confirms with one tap (not free
 *  selection). Reconciliation is always teacher-confirmed; this is a hint only. */
export function suggestSessionId(bucket: ScanBucket, sessions: TeacherSession[]): string | null {
  return matchingSessions(bucket, sessions)[0]?.id ?? null;
}

/** A session id only when exactly one session plausibly matches. Retained as a
 *  shared helper (e.g. to mark a pre-selection as unambiguous in the UI); it is
 *  NOT used to auto-submit — connectivity never triggers a sync. */
export function confidentSessionId(bucket: ScanBucket, sessions: TeacherSession[]): string | null {
  const matches = matchingSessions(bucket, sessions);
  return matches.length === 1 ? matches[0].id : null;
}

/**
 * Apply a batch response to local storage: delete scans that are safely on the
 * server (synced/already_recorded), mark the rest failed (kept + surfaced).
 * Results are returned in submitted order, so we zip by index. Used by the
 * manual reconciliation screen after the teacher confirms a bucket's session.
 */
export async function applyBatchResults(
  bucket: ScanBucket,
  results: OfflineScanResult[],
): Promise<{ synced: number; failed: number }> {
  const toDelete: number[] = [];
  let failed = 0;
  results.forEach((r, idx) => {
    const local = bucket.scans[idx];
    if (!local) return;
    if (r.outcome === 'synced' || r.outcome === 'already_recorded') {
      toDelete.push(local.id);
    } else {
      failed++;
      markScanFailed(local.id, r.message || r.code || 'failed');
    }
  });
  await deleteScans(toDelete);
  return { synced: toDelete.length, failed };
}
