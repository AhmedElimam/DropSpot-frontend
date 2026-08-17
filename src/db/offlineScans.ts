import * as SQLite from 'expo-sqlite';

/**
 * Offline scan buffer (expo-sqlite). Every card scan is written to disk here
 * BEFORE any network attempt, so nothing is lost to a crash or lost connectivity.
 * A row's only job is to survive until it's safely on the server: once synced it
 * is deleted immediately (reliability addendum §1) — this table only ever holds
 * scans that are still pending or that failed a sync and need attention.
 */
export interface OfflineScan {
  id: number;
  card_code: string;
  scanned_at: string; // ISO8601, device capture time
  // The teacher context ACTIVE ON THIS DEVICE at the moment of scanning
  // (multi-teacher assistants). Stamped here at scan time — never re-resolved at
  // sync time — so a batch scanned for teacher A stays attributed to A even if
  // the assistant switches to teacher B before reconnecting (spec §4). 0/null for
  // a solo teacher or an unknown context.
  teacher_id: number | null;
  last_error: string | null;
  // 'pending'  — still to sync; eligible for bucketing + (re)submission.
  // 'rejected' — the server gave a definitive per-scan verdict (e.g. NOT_ENROLLED,
  //   CARD_EXPIRED, BILLING_OVERDUE). Resending the identical scan to the same
  //   session cannot change that outcome, so it is NEVER auto-retried — it waits
  //   for a human decision (dismiss, or re-queue against a different session).
  //   This is the transient-vs-permanent split (reliability addendum §2).
  status: 'pending' | 'rejected';
}

let dbRef: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!dbRef) {
    dbRef = SQLite.openDatabaseSync('drosspot.db');
  }
  return dbRef;
}

/** Create the table if needed. Safe to call on every app start. */
export async function initOfflineScans(): Promise<void> {
  await db().execAsync(`
    CREATE TABLE IF NOT EXISTS offline_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_code TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      teacher_id INTEGER,
      last_error TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  // Additive migrations for installs created before a column existed. ALTER on an
  // existing column throws; swallowing that is the standard SQLite "add column if
  // missing" idiom. Order matters only in that each is independent.
  for (const alter of [
    'ALTER TABLE offline_scans ADD COLUMN teacher_id INTEGER',
    "ALTER TABLE offline_scans ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
  ]) {
    try {
      await db().execAsync(alter);
    } catch {
      // Column already present — nothing to do.
    }
  }
}

/**
 * Persist a scan to disk, stamped with the active teacher context. Returns the
 * row id. Throws if the write fails (e.g. the device is out of storage) — the
 * caller MUST surface that, because a scan that never hit the buffer is a scan
 * that will be silently lost (reliability addendum §6).
 */
export async function bufferScan(cardCode: string, scannedAt: string, teacherId: number | null): Promise<number> {
  const res = await db().runAsync(
    "INSERT INTO offline_scans (card_code, scanned_at, teacher_id, last_error, status) VALUES (?, ?, ?, NULL, 'pending')",
    cardCode,
    scannedAt,
    teacherId ?? null,
  );
  return res.lastInsertRowId;
}

/**
 * Pending scans only, chronological (bucketing depends on this order). Rejected
 * scans are deliberately excluded so a permanent business rejection is never
 * silently re-bucketed and re-sent (addendum §2). Rows written before the status
 * column existed default to pending via the migration.
 */
export async function getPendingScans(): Promise<OfflineScan[]> {
  return db().getAllAsync<OfflineScan>(
    "SELECT * FROM offline_scans WHERE status = 'pending' ORDER BY scanned_at ASC",
  );
}

/** Scans the server has permanently rejected — surfaced for a human decision. */
export async function getRejectedScans(): Promise<OfflineScan[]> {
  return db().getAllAsync<OfflineScan>(
    "SELECT * FROM offline_scans WHERE status = 'rejected' ORDER BY scanned_at ASC",
  );
}

/** Count of scans still waiting to sync (drives the "waiting to sync" badge). */
export async function countPendingScans(): Promise<number> {
  const row = await db().getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM offline_scans WHERE status = 'pending'",
  );
  return row?.c ?? 0;
}

/** Count of scans permanently rejected and awaiting a decision. */
export async function countRejectedScans(): Promise<number> {
  const row = await db().getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM offline_scans WHERE status = 'rejected'",
  );
  return row?.c ?? 0;
}

/** Delete a single synced scan immediately (addendum §1). Also the "dismiss" for a rejected scan. */
export async function deleteScan(id: number): Promise<void> {
  await db().runAsync('DELETE FROM offline_scans WHERE id = ?', id);
}

/** Delete many synced scans in one statement. */
export async function deleteScans(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db().runAsync(`DELETE FROM offline_scans WHERE id IN (${placeholders})`, ...ids);
}

/**
 * Mark a scan as permanently rejected (addendum §2): kept locally, taken OUT of
 * the retry queue, and surfaced to the teacher as "needs your decision".
 */
export async function markScanRejected(id: number, error: string): Promise<void> {
  await db().runAsync("UPDATE offline_scans SET status = 'rejected', last_error = ? WHERE id = ?", error, id);
}

/**
 * Return a rejected scan to the pending queue (the teacher's decision: "try this
 * one again", typically against a different session). Clears the stale error.
 */
export async function requeueScan(id: number): Promise<void> {
  await db().runAsync("UPDATE offline_scans SET status = 'pending', last_error = NULL WHERE id = ?", id);
}
