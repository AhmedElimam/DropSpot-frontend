import type { OfflineMark } from './offlineMarks';
import type { SessionDetail, SessionAttendee, OfflineMarkResult } from '@/api/teacherSessions';

/**
 * Pure helpers for the offline manual-mark queue (unit-tested; no I/O).
 */

/** What the roster should SHOW: the server's picture with the queued intents laid on top. */
export function applyPendingMarks(detail: SessionDetail, pending: OfflineMark[]): SessionDetail {
  if (!pending.length) return detail;
  const byStudent = new Map(pending.map((m) => [m.student_id, m]));
  const overlay = <T extends SessionAttendee>(a: T): T => {
    const m = byStudent.get(a.student_id);
    if (!m) return a;
    return { ...a, status: m.status, method: 'manual', pending_sync: true };
  };
  const attendees = detail.attendees.map(overlay);
  const swap_ins = detail.swap_ins?.map(overlay);
  const present_count = attendees.filter((a) => a.status === 'present' || a.status === 'late').length;
  return { ...detail, attendees, swap_ins, present_count };
}

/**
 * Sort the server's per-row verdicts into what to drop and what to park.
 *  - synced / already_applied: the server has it → delete the row.
 *  - stale: something newer is already on the record → the intent is obsolete, delete it
 *    (the caller refreshes the session so the teacher sees the newer truth).
 *  - failed: a permanent refusal (not enrolled, no allowance, not your session) → parked
 *    for a decision, never auto-retried.
 */
export function applyMarkResults(rows: OfflineMark[], results: OfflineMarkResult[]): {
  toDelete: number[];
  toReject: { id: number; error: string }[];
  synced: number;
  staleSessionIds: number[];
} {
  const byUuid = new Map(rows.map((r) => [r.client_uuid, r]));
  const toDelete: number[] = [];
  const toReject: { id: number; error: string }[] = [];
  const staleSessionIds: number[] = [];
  let synced = 0;
  for (const r of results) {
    const row = byUuid.get(r.client_uuid);
    if (!row) continue;
    if (r.outcome === 'synced') { synced++; toDelete.push(row.id); }
    else if (r.outcome === 'already_applied') toDelete.push(row.id);
    else if (r.outcome === 'stale') { toDelete.push(row.id); staleSessionIds.push(row.session_instance_id); }
    else toReject.push({ id: row.id, error: r.message || r.code || 'failed' });
  }
  return { toDelete, toReject, synced, staleSessionIds };
}

/** Is this a "the request never reached the server" error (vs. a server verdict)? */
export function isNetworkFailure(e: unknown): boolean {
  const err = e as { response?: unknown; code?: string; message?: string } | null;
  if (!err) return false;
  if (err.response) return false; // the server answered — that is a verdict, not a dropout
  return true;
}
