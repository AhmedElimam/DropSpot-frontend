import client from './client';
import { extractList, extractAttrs } from './utils';

// Teacher sessions HISTORY (beyond today) + per-session attendance detail. The
// existing /teacher/sessions/today is today-only and carries no attendee roster.

export interface SessionRow {
  id: string;
  course_name: string | null;
  scheduled_at: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  status: string;
  checked_in_count: number;
}

export interface SessionsPage {
  items: SessionRow[];
  meta: { current_page: number; last_page: number; total: number };
}

export interface SessionAttendee {
  student_id: number;
  name: string | null;
  student_code: string | null;
  card_less: boolean;
  status: string; // present | late | absent | excused | not_recorded
  method: string | null;
  checked_in_at: string | null;
  // Sheet tracking
  mark: number | null;
  sheet_marked: boolean;
  sheet_awaited: boolean;
  note: string | null;
  /** Cross-tenant: this student's parent number was confirmed not genuine. */
  number_flagged?: boolean;
}

/** A student swapped INTO this session (one-time makeup) — roster attendee + origin. */
export interface SwapInAttendee extends SessionAttendee {
  /** Where the student was swapped from ("course — day"), for the makeup tab. */
  from_label: string | null;
}

export interface SessionDetail {
  id: string;
  course_id: number | null;
  course_name: string | null;
  scheduled_at: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  status: string;
  present_count: number;
  total_count: number;
  // Session-level control state
  is_cancelled: boolean;
  is_completed: boolean;
  is_past: boolean;
  sheet_expected: boolean;
  sheet_excluded: boolean;
  sheet_max_mark: number | null;
  attendees: SessionAttendee[];
  /** Students swapped INTO this session — shown in a separate, non-default tab. */
  swap_ins?: SwapInAttendee[];
}

export async function getTeacherSessions(params?: { status?: string; page?: number }): Promise<SessionsPage> {
  const { data } = await client.get('/teacher/sessions', { params });
  const items = extractList(data, 'teacher-session-row').map((item: any) => {
    const attrs = extractAttrs(item);
    return { ...attrs, id: String(item.id ?? attrs.id) } as SessionRow;
  });
  const meta = data.meta ?? { current_page: 1, last_page: 1, total: items.length };
  return { items, meta };
}

export async function getSessionDetail(id: string | number): Promise<SessionDetail> {
  const { data } = await client.get(`/teacher/sessions/${id}`);
  return (data.data ?? data) as SessionDetail;
}

// ---- Session write controls (full parity with the web SessionsController) ----
// Every mutation returns the refreshed SessionDetail so the screen updates in place.

function detail(data: any): SessionDetail {
  return (data.data ?? data) as SessionDetail;
}

export async function markAttendance(
  sessionId: string | number,
  studentId: number,
  status: 'present' | 'late' | 'absent' | 'excused',
): Promise<SessionDetail> {
  const { data } = await client.post(`/teacher/sessions/${sessionId}/mark`, { student_id: studentId, status });
  return detail(data);
}

export async function cancelSession(sessionId: string | number): Promise<SessionDetail> {
  const { data } = await client.post(`/teacher/sessions/${sessionId}/cancel`);
  return detail(data);
}

export async function restoreSession(sessionId: string | number): Promise<SessionDetail> {
  const { data } = await client.post(`/teacher/sessions/${sessionId}/restore`);
  return detail(data);
}

export async function recordNote(sessionId: string | number, studentId: number, note: string): Promise<SessionDetail> {
  const { data } = await client.post(`/teacher/sessions/${sessionId}/note`, { student_id: studentId, note });
  return detail(data);
}

export async function recordSheetGrade(
  sessionId: string | number,
  studentId: number,
  mark: number | null,
): Promise<SessionDetail> {
  const { data } = await client.post(`/teacher/sessions/${sessionId}/sheet-grade`, { student_id: studentId, mark });
  return detail(data);
}

export async function toggleSheet(sessionId: string | number, studentId: number): Promise<SessionDetail> {
  const { data } = await client.post(`/teacher/sessions/${sessionId}/sheet-toggle`, { student_id: studentId });
  return detail(data);
}

export async function toggleSheetExcluded(sessionId: string | number): Promise<SessionDetail> {
  const { data } = await client.post(`/teacher/sessions/${sessionId}/sheet-excluded`);
  return detail(data);
}

export async function updateSheetMaxMark(sessionId: string | number, max: number | null): Promise<SessionDetail> {
  const { data } = await client.post(`/teacher/sessions/${sessionId}/sheet-max-mark`, { sheet_max_mark: max });
  return detail(data);
}

export async function pauseSessions(from: string, to: string): Promise<{ cancelled: number }> {
  const { data } = await client.post('/teacher/sessions/pause', { from, to });
  return (data.data ?? data) as { cancelled: number };
}
