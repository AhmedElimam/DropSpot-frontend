import * as SQLite from 'expo-sqlite';

/**
 * Offline queue for MANUAL attendance marks (founder 2026-10-02: "on manual checking in and
 * absence we need to enable it offline"). Sibling of offline_scans, same rules: a row exists
 * only until the server has it, then it is deleted; a permanent per-row refusal parks it as
 * 'rejected' for a human decision and is never retried on its own.
 *
 * One row per (session, student): marking a student present and then absent while offline
 * collapses to the LAST intent, which is exactly what the server would have done had the
 * two requests arrived live (last write wins). The client_uuid changes with each rewrite so
 * the server can tell a retry of the same mark from a new one.
 */
export type MarkStatus = 'present' | 'late' | 'absent' | 'excused';

export interface OfflineMark {
  id: number;
  client_uuid: string;
  session_instance_id: number;
  student_id: number;
  status: MarkStatus;
  marked_at: string; // ISO8601, device time when the teacher tapped
  teacher_id: number | null; // context stamped at mark time (multi-teacher assistants)
  student_name: string | null; // for the reconcile screen only
  course_name: string | null;
  last_error: string | null;
  state: 'pending' | 'rejected';
}

let dbRef: SQLite.SQLiteDatabase | null = null;
function db(): SQLite.SQLiteDatabase {
  if (!dbRef) dbRef = SQLite.openDatabaseSync('drosspot.db');
  return dbRef;
}

export async function initOfflineMarks(): Promise<void> {
  await db().execAsync(`
    CREATE TABLE IF NOT EXISTS offline_marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid TEXT NOT NULL UNIQUE,
      session_instance_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      marked_at TEXT NOT NULL,
      teacher_id INTEGER,
      student_name TEXT,
      course_name TEXT,
      last_error TEXT,
      state TEXT NOT NULL DEFAULT 'pending',
      UNIQUE(session_instance_id, student_id)
    );
  `);
}

/** Queue (or replace) the mark for this student in this session. Throws if the write fails. */
export async function queueMark(m: Omit<OfflineMark, 'id' | 'last_error' | 'state'>): Promise<void> {
  await db().runAsync(
    `INSERT INTO offline_marks (client_uuid, session_instance_id, student_id, status, marked_at, teacher_id, student_name, course_name, last_error, state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')
     ON CONFLICT(session_instance_id, student_id) DO UPDATE SET
       client_uuid = excluded.client_uuid, status = excluded.status, marked_at = excluded.marked_at,
       teacher_id = excluded.teacher_id, student_name = excluded.student_name, course_name = excluded.course_name,
       last_error = NULL, state = 'pending'`,
    m.client_uuid, m.session_instance_id, m.student_id, m.status, m.marked_at, m.teacher_id ?? null, m.student_name ?? null, m.course_name ?? null,
  );
}

export async function getPendingMarks(): Promise<OfflineMark[]> {
  return db().getAllAsync<OfflineMark>("SELECT * FROM offline_marks WHERE state = 'pending' ORDER BY marked_at ASC");
}

export async function getPendingMarksForSession(sessionId: number): Promise<OfflineMark[]> {
  return db().getAllAsync<OfflineMark>("SELECT * FROM offline_marks WHERE state = 'pending' AND session_instance_id = ?", sessionId);
}

export async function getRejectedMarks(): Promise<OfflineMark[]> {
  return db().getAllAsync<OfflineMark>("SELECT * FROM offline_marks WHERE state = 'rejected' ORDER BY marked_at ASC");
}

export async function countPendingMarks(): Promise<number> {
  const row = await db().getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM offline_marks WHERE state = 'pending'");
  return row?.c ?? 0;
}

export async function countRejectedMarks(): Promise<number> {
  const row = await db().getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM offline_marks WHERE state = 'rejected'");
  return row?.c ?? 0;
}

export async function deleteMarks(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await db().runAsync(`DELETE FROM offline_marks WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids);
}

export async function markMarkRejected(id: number, error: string): Promise<void> {
  await db().runAsync("UPDATE offline_marks SET state = 'rejected', last_error = ? WHERE id = ?", error, id);
}

export async function requeueMark(id: number): Promise<void> {
  await db().runAsync("UPDATE offline_marks SET state = 'pending', last_error = NULL WHERE id = ?", id);
}
