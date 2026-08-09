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
      last_error TEXT
    );
  `);

  // Additive migration for installs created before the teacher_id stamp existed.
  // ALTER on an existing column throws; swallowing that is the standard SQLite
  // "add column if missing" idiom.
  try {
    await db().execAsync('ALTER TABLE offline_scans ADD COLUMN teacher_id INTEGER');
  } catch {
    // Column already present — nothing to do.
  }
}

/** Persist a scan to disk, stamped with the active teacher context. Returns the row id. */
export async function bufferScan(cardCode: string, scannedAt: string, teacherId: number | null): Promise<number> {
  const res = await db().runAsync(
    'INSERT INTO offline_scans (card_code, scanned_at, teacher_id, last_error) VALUES (?, ?, ?, NULL)',
    cardCode,
    scannedAt,
    teacherId ?? null,
  );
  return res.lastInsertRowId;
}

/** All pending scans, chronological (bucketing depends on this order). */
export async function getPendingScans(): Promise<OfflineScan[]> {
  return db().getAllAsync<OfflineScan>('SELECT * FROM offline_scans ORDER BY scanned_at ASC');
}

export async function countPendingScans(): Promise<number> {
  const row = await db().getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM offline_scans');
  return row?.c ?? 0;
}

/** Delete a single synced scan immediately (addendum §1). */
export async function deleteScan(id: number): Promise<void> {
  await db().runAsync('DELETE FROM offline_scans WHERE id = ?', id);
}

/** Delete many synced scans in one statement. */
export async function deleteScans(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db().runAsync(`DELETE FROM offline_scans WHERE id IN (${placeholders})`, ...ids);
}

/** Mark a scan as failed (kept locally, surfaced to the teacher — addendum §2). */
export async function markScanFailed(id: number, error: string): Promise<void> {
  await db().runAsync('UPDATE offline_scans SET last_error = ? WHERE id = ?', error, id);
}
