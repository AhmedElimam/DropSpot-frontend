import * as SQLite from 'expo-sqlite';

/**
 * Actions taken with no connection, waiting to be sent (src/api/offlineQueue.ts decides
 * which may wait). Sibling of offline_scans and offline_marks, same rules: a row lives only
 * until the server has accepted it, then it is deleted; a server refusal parks it as
 * 'rejected' for a human decision and is never retried on its own.
 *
 * Replayed in the order they were taken, with the X-Idempotency-Key each was first sent
 * with: the server answers a repeat from memory instead of running it again.
 */
export interface OutboxAction {
  id: number;
  key: string; // the idempotency key, also the replay's
  method: string;
  url: string;
  body: string | null; // JSON, exactly as first sent
  label: string; // «تحصيل · 300 ج.م» — for the sync screen
  teacher_id: number | null; // context at the time (multi-teacher assistants)
  created_at: string; // ISO8601, device time
  last_error: string | null;
  state: 'pending' | 'rejected';
}

let dbRef: SQLite.SQLiteDatabase | null = null;
function db(): SQLite.SQLiteDatabase {
  if (!dbRef) dbRef = SQLite.openDatabaseSync('drosspot.db');
  return dbRef;
}

export async function initOutbox(): Promise<void> {
  await db().execAsync(`
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      body TEXT,
      label TEXT NOT NULL,
      teacher_id INTEGER,
      created_at TEXT NOT NULL,
      last_error TEXT,
      state TEXT NOT NULL DEFAULT 'pending'
    );
  `);
}

export async function enqueueAction(a: Omit<OutboxAction, 'id' | 'last_error' | 'state' | 'created_at'>): Promise<void> {
  await db().runAsync(
    `INSERT OR IGNORE INTO outbox (key, method, url, body, label, teacher_id, created_at, last_error, state)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    a.key, a.method, a.url, a.body, a.label, a.teacher_id, new Date().toISOString(),
  );
}

/** Oldest first — the order they were taken in. */
export async function getPendingActions(): Promise<OutboxAction[]> {
  return db().getAllAsync<OutboxAction>(`SELECT * FROM outbox WHERE state = 'pending' ORDER BY id ASC`);
}

export async function getRejectedActions(): Promise<OutboxAction[]> {
  return db().getAllAsync<OutboxAction>(`SELECT * FROM outbox WHERE state = 'rejected' ORDER BY id ASC`);
}

export async function countPendingActions(): Promise<number> {
  const row = await db().getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM outbox WHERE state = 'pending'`);
  return row?.n ?? 0;
}

export async function countRejectedActions(): Promise<number> {
  const row = await db().getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM outbox WHERE state = 'rejected'`);
  return row?.n ?? 0;
}

export async function deleteActions(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await db().runAsync(`DELETE FROM outbox WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids);
}

export async function markActionRejected(id: number, error: string): Promise<void> {
  await db().runAsync(`UPDATE outbox SET state = 'rejected', last_error = ? WHERE id = ?`, error, id);
}

/** Back to the queue for another try (a new key: the old answer must not be replayed). */
export async function requeueAction(id: number, newKey: string): Promise<void> {
  await db().runAsync(`UPDATE outbox SET state = 'pending', last_error = NULL, key = ? WHERE id = ?`, newKey, id);
}

/** Sign-out: the next person on this phone never sends the last one's actions. */
export async function clearOutbox(): Promise<void> {
  await db().runAsync(`DELETE FROM outbox`);
}
