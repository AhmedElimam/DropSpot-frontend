import {
  getTeacherTodaySessions,
  syncOfflineBatch,
  type TeacherSession,
  type OfflineScanResult,
} from '@/api/teacher';
import { getPendingScans, deleteScans, markScanFailed } from './offlineScans';
import { computeBuckets, type ScanBucket } from './buckets';
import { useOfflineStore } from '@/stores/offlineStore';

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

/** First plausible session for a bucket (UI pre-select — minimal-tap). */
export function suggestSessionId(bucket: ScanBucket, sessions: TeacherSession[]): string | null {
  return matchingSessions(bucket, sessions)[0]?.id ?? null;
}

/** A session id ONLY when exactly one session plausibly matches (safe to auto-sync). */
export function confidentSessionId(bucket: ScanBucket, sessions: TeacherSession[]): string | null {
  const matches = matchingSessions(bucket, sessions);
  return matches.length === 1 ? matches[0].id : null;
}

/**
 * Apply a batch response to local storage: delete scans that are safely on the
 * server (synced/already_recorded), mark the rest failed (kept + surfaced).
 * Results are returned in submitted order, so we zip by index.
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

/**
 * Auto-flush on reconnect: sync only buckets with EXACTLY ONE plausible session
 * (unambiguous → safe to submit without asking). Ambiguous buckets are left for
 * the teacher to resolve on the reconciliation screen. Uses each scan's original
 * scanned_at, so window validation stays correct however late this runs.
 * Best-effort: any error leaves that bucket buffered.
 *
 * @return number of scans auto-synced.
 */
export async function autoFlush(): Promise<number> {
  const pending = await getPendingScans();
  if (pending.length === 0) return 0;

  let sessions: TeacherSession[];
  try {
    sessions = await getTeacherTodaySessions();
  } catch {
    return 0; // still offline / unauthorized — nothing to do
  }

  let synced = 0;
  for (const bucket of computeBuckets(pending)) {
    const sessionId = confidentSessionId(bucket, sessions);
    if (!sessionId) continue; // ambiguous → manual reconciliation

    try {
      const res = await syncOfflineBatch(
        Number(sessionId),
        bucket.scans.map((s) => ({ card_code: s.card_code, scanned_at: s.scanned_at })),
      );
      const applied = await applyBatchResults(bucket, res.results);
      synced += applied.synced;
    } catch {
      // Leave this bucket buffered; the teacher can reconcile manually.
    }
  }

  await useOfflineStore.getState().refresh();
  return synced;
}
