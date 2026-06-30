import client from './client';
import type { SessionInstance } from '@/types/session-instance';

export async function getStudentSessions(studentId: number, params?: {
  status?: string;
  from?: string;
  to?: string;
}): Promise<SessionInstance[]> {
  const { data } = await client.get(`/students/${studentId}/sessions`, { params });
  return data.data?.map(extractSession) ?? [];
}

export async function getTodayStudentSessions(studentId: number): Promise<SessionInstance[]> {
  const { data } = await client.get(`/students/${studentId}/sessions/today`);
  return data.data?.map(extractSession) ?? [];
}

export async function getUpcomingStudentSessions(studentId: number, limit = 10): Promise<SessionInstance[]> {
  const { data } = await client.get(`/students/${studentId}/sessions/upcoming`, { params: { limit } });
  return data.data?.map(extractSession) ?? [];
}

function extractSession(item: any): SessionInstance {
  const a = item.attributes ?? item;
  return {
    id: parseInt(item.id, 10),
    session_schedule_id: a.session_schedule_id,
    scheduled_at: a.scheduled_at,
    actual_at: a.actual_at,
    duration_minutes: a.duration_minutes,
    status: a.status,
    location: a.location,
    is_override: a.is_override,
    override_reason: a.override_reason,
    qr_token: a.qr_token,
    course_name: a.course_name,
    teacher_name: a.teacher_name,
    grade_name: a.grade_name,
  };
}
