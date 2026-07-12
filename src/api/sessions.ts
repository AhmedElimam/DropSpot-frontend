import client from './client';
import { extractList, extractAttrs } from './utils';
import type { SessionInstance } from '@/types/session-instance';

export async function getStudentSessions(studentId: number, params?: {
  status?: string;
  from?: string;
  to?: string;
}): Promise<SessionInstance[]> {
  const { data } = await client.get(`/students/${studentId}/sessions`, { params });
  return extractList(data, 'sessions').map(extractSession);
}

export async function getTodayStudentSessions(studentId: number): Promise<SessionInstance[]> {
  const { data } = await client.get(`/students/${studentId}/sessions/today`);
  return extractList(data, 'sessions').map(extractSession);
}

export async function getUpcomingStudentSessions(studentId: number, limit = 10): Promise<SessionInstance[]> {
  const { data } = await client.get(`/students/${studentId}/sessions/upcoming`, { params: { limit } });
  return extractList(data, 'sessions').map(extractSession);
}

function extractSession(item: any): SessionInstance {
  const a = extractAttrs(item);
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
    course_name: a.course_name,
    course_latitude: a.course_latitude ?? null,
    radius_horizontal_meters: a.radius_horizontal_meters ?? 20,
    phone_checkin_allowed: a.phone_checkin_allowed ?? false,
    checkin_permission_expires_at: a.checkin_permission_expires_at ?? null,
    course_longitude: a.course_longitude ?? null,
    teacher_name: a.teacher_name,
    grade_name: a.grade_name,
  };
}
