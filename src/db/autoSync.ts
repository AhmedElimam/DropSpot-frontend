import { syncOfflineBatch } from '@/api/teacher';
import { getPendingScans, deleteScans, markScanRejected, type OfflineScan } from './offlineScans';
import { getFreshScheduleEntries, localDateKey, type ScheduleCacheEntry } from './scheduleCache';
import { matchAutoSession } from './autoSyncMatch';
import { useOfflineStore } from '@/stores/offlineStore';

/**
 * Window-bounded AUTOMATIC offline sync (main spec). Only the UNAMBIGUOUS case is
 * automated: a buffered scan whose captured time falls inside EXACTLY ONE cached
 * session window (matchAutoSession), resolved against THAT scan's own stamped teacher
 * (attribution is fixed at scan time, never re-resolved here). Everything else — no
 * window (between sessions), two overlapping windows, a stale/absent cache, or a
 * server rejection — stays in the manual reconcile queue. Nothing is ever lost.
 */

export { matchAutoSession } from './autoSyncMatch';

function teacherKey(id: number | null): string {
  return String(id ?? 'solo');
}

/**
 * One silent, best-effort auto-sync pass. Returns how many scans were uploaded.
 * Per-scan results are applied independently: synced/already_recorded → deleted;
 * a permanent per-scan rejection (NOT_ENROLLED, CARD_EXPIRED, ABSENT_OVERRIDE_BLOCKED)
 * → moved to the "needs your decision" bucket (never retried); a whole-batch/network
 * failure → the scans stay buffered untouched for the next pass.
 */
export async function runAutoSync(now: Date = new Date()): Promise<number> {
  const pending = await getPendingScans();
  if (!pending.length) return 0;

  // Today-only cache entries, one per teacher context (stale ones already pruned).
  const entries = await getFreshScheduleEntries(now);
  const byTeacher = new Map<string, ScheduleCacheEntry>();
  for (const e of entries) byTeacher.set(teacherKey(e.teacher_id), e);

  // Group eligible scans by the session they unambiguously belong to.
  const bySession = new Map<string, { teacherId: number | null; scans: OfflineScan[] }>();
  for (const scan of pending) {
    const entry = byTeacher.get(teacherKey(scan.teacher_id ?? null));
    if (!entry) continue; // no fresh cache for THIS scan's teacher → manual (§4.3/4.4)
    // §4.4 — the cache must be valid for the scan's OWN date, not merely "today".
    if (localDateKey(new Date(scan.scanned_at)) !== entry.date) continue;
    const sid = matchAutoSession(new Date(scan.scanned_at).getTime(), entry.sessions);
    if (!sid) continue; // no window / ambiguous → manual (§4.1)
    const group = bySession.get(sid) ?? { teacherId: entry.teacher_id, scans: [] };
    group.scans.push(scan);
    bySession.set(sid, group);
  }

  let synced = 0;
  for (const [sid, group] of bySession) {
    try {
      const resp = await syncOfflineBatch(
        Number(sid),
        group.scans.map((s) => ({ card_code: s.card_code, scanned_at: s.scanned_at })),
        group.teacherId, // §4.2 — server refuses CONTEXT_MISMATCH if it isn't this teacher's session
        true, // auto
      );
      // Apply per-scan outcomes, dup-safe by card_code (mirrors reconcile.applyBatchResults).
      const byCode = new Map<string, number[]>();
      for (const s of group.scans) {
        const q = byCode.get(s.card_code) ?? [];
        q.push(s.id);
        byCode.set(s.card_code, q);
      }
      const toDelete: number[] = [];
      for (const r of resp.results) {
        const id = byCode.get(r.card_code)?.shift();
        if (id === undefined) continue; // result for a card not in this group — ignore
        if (r.outcome === 'synced' || r.outcome === 'already_recorded') {
          toDelete.push(id);
        } else {
          await markScanRejected(id, r.message || r.code || 'failed'); // permanent → decision bucket
        }
      }
      await deleteScans(toDelete);
      synced += toDelete.length;
    } catch {
      // Transient (offline / 5xx / batch-level refusal): leave the scans buffered (§6).
    }
  }

  return synced;
}

// --- Rate-limited trigger ---------------------------------------------------
// Fires on connectivity-restored and on foreground. A flapping connection must not
// hammer the endpoint (§5): at most one run in flight, and no more than one run per
// MIN_INTERVAL_MS regardless of how many triggers arrive.
const MIN_INTERVAL_MS = 15_000;
let inFlight = false;
let lastRunAt = 0;

/**
 * Kick an auto-sync pass if online, not already running, and past the cool-down.
 * On a successful pass with uploads, updates the passive-confirmation count and the
 * badge counts. Never throws.
 */
export async function triggerAutoSync(nowMs: number = Date.now()): Promise<void> {
  if (inFlight) return;
  if (!useOfflineStore.getState().online) return;
  if (nowMs - lastRunAt < MIN_INTERVAL_MS) return;

  inFlight = true;
  lastRunAt = nowMs;
  try {
    const synced = await runAutoSync();
    if (synced > 0) {
      useOfflineStore.getState().bumpAutoSynced(synced);
      await useOfflineStore.getState().refresh();
    }
  } catch {
    // best-effort — a failed pass leaves everything buffered
  } finally {
    inFlight = false;
  }
}
