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
      last_error TEXT
    );
  `);
}

/** Persist a scan to disk. Returns the local row id. */
export async function bufferScan(cardCode: string, scannedAt: string): Promise<number> {
  const res = await db().runAsync(
    'INSERT INTO offline_scans (card_code, scanned_at, last_error) VALUES (?, ?, NULL)',
    cardCode,
    scannedAt,
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
