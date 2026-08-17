import type { TeacherSession, OfflineScanResult } from '@/api/teacher';
import { deleteScans, markScanRejected } from './offlineScans';
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
 * Apply a batch response to local storage (addendum §1 & §2):
 *  - synced / already_recorded → safely on the server, delete locally;
 *  - failed → the server gave a definitive per-scan verdict; resending the same
 *    scan to the same session can't change it, so mark it REJECTED (kept, out of
 *    the retry queue, surfaced for a human decision) — never re-bucketed.
 *
 * Each result carries its card_code, so we MATCH BY card_code rather than blindly
 * zipping by index. The server does preserve submit order, but a strict index zip
 * would silently mis-map every row after any future reordering or a length
 * mismatch. We consume matches in order to stay correct even when the same card
 * appears twice in one bucket. A local row with no matching result is left
 * untouched (still pending) — we never delete a scan we can't account for.
 */
export async function applyBatchResults(
  bucket: ScanBucket,
  results: OfflineScanResult[],
): Promise<{ synced: number; rejected: number }> {
  // card_code → queue of local row ids, in submit order (dup-safe: two scans of
  // the same card get consumed one at a time, first-in-first-out).
  const byCode = new Map<string, number[]>();
  for (const local of bucket.scans) {
    const q = byCode.get(local.card_code) ?? [];
    q.push(local.id);
    byCode.set(local.card_code, q);
  }

  const toDelete: number[] = [];
  const toReject: { id: number; reason: string }[] = [];

  for (const r of results) {
    const queue = byCode.get(r.card_code);
    const localId = queue?.shift();
    if (localId === undefined) continue; // result for a card not in this bucket — ignore
    if (r.outcome === 'synced' || r.outcome === 'already_recorded') {
      toDelete.push(localId);
    } else {
      toReject.push({ id: localId, reason: r.message || r.code || 'failed' });
    }
  }

  await deleteScans(toDelete);
  for (const { id, reason } of toReject) {
    await markScanRejected(id, reason);
  }
  return { synced: toDelete.length, rejected: toReject.length };
}
