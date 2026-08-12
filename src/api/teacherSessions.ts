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
  status: string; // present | late | absent | excused | not_recorded
  method: string | null;
  checked_in_at: string | null;
}

export interface SessionDetail {
  id: string;
  course_name: string | null;
  scheduled_at: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  status: string;
  present_count: number;
  total_count: number;
  attendees: SessionAttendee[];
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
