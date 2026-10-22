import client from './client';
import type { AttendanceModeFields } from '@/types/attendance-mode';

/**
 * «ملاحظات الحصص» for a family (founder 2026-10-22): per session a child belonged to, the
 * teacher's note to the whole session and the child's own note — any time, newest first.
 * One entry per (session, child); a page is a page of sessions.
 */
export interface SessionNoteEntry extends AttendanceModeFields {
  id: string;
  session_instance_id: string;
  student_id: string;
  student_name: string | null;
  course_name: string | null;
  teacher_name: string | null;
  scheduled_at: string | null;
  /** present | late | absent | excused; null when unrecorded or a private lesson. */
  status: string | null;
  summary: string | null;
  note: string | null;
  written_at: string | null;
}

export interface SessionNotesPage {
  items: SessionNoteEntry[];
  meta: { current_page: number; last_page: number; total: number };
}

function page(data: any): SessionNotesPage {
  return {
    items: (data?.data ?? []) as SessionNoteEntry[],
    meta: data?.meta ?? { current_page: 1, last_page: 1, total: 0 },
  };
}

/** A parent: one child, or every child when `studentId` is omitted. */
export async function getFamilySessionNotes(p: { studentId?: string | null; page?: number }): Promise<SessionNotesPage> {
  const { data } = await client.get('/parents/session-notes', {
    params: { page: p.page ?? 1, ...(p.studentId ? { student_id: p.studentId } : {}) },
  });
  return page(data);
}

/** A student: their own. */
export async function getMySessionNotes(p: { page?: number }): Promise<SessionNotesPage> {
  const { data } = await client.get('/students/session-notes', { params: { page: p.page ?? 1 } });
  return page(data);
}
