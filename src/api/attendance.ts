import client from './client';
import { extractList, extractAttrs } from './utils';
import type { AttendanceRecord, AbsenceExcuse, AttendanceStatus } from '@/types/attendance';

export async function getAttendanceRecords(studentId: number, params?: {
  from?: string;
  to?: string;
}): Promise<AttendanceRecord[]> {
  const { data } = await client.get(`/students/${studentId}/attendance`, { params });
  return extractList(data, 'attendance').map(extractRecord);
}

export async function checkIn(
  sessionInstanceId: number,
  studentId: number,
  latitude?: number,
  longitude?: number,
): Promise<AttendanceRecord> {
  const { data } = await client.post('/attendance/check-in', {
    session_instance_id: sessionInstanceId,
    student_id: studentId,
    latitude,
    longitude,
  });
  return extractRecord(extractAttrs(data.data ?? data));
}

export async function submitExcuse(
  attendanceRecordId: number,
  reason: string,
): Promise<AbsenceExcuse> {
  const { data } = await client.post('/absence-excuses', {
    attendance_record_id: attendanceRecordId,
    reason,
  });
  return extractAttrs(data.data ?? data);
}

export async function getSessionAttendance(sessionInstanceId: number): Promise<AttendanceRecord[]> {
  const { data } = await client.get(`/session-instances/${sessionInstanceId}/attendance`);
  return extractList(data, 'attendance').map(extractRecord);
}

export async function getStudentCoverage(studentId: number): Promise<{
  present: number;
  absent: number;
  excused: number;
  late: number;
  total: number;
}> {
  const { data } = await client.get(`/students/${studentId}/attendance/stats`);
  return extractAttrs(data.data ?? data);
}

function extractRecord(item: any): AttendanceRecord {
  const a = extractAttrs(item);
  return {
    id: item.id ? parseInt(item.id, 10) : 0,
    session_instance_id: a.session_instance_id,
    student_id: a.student_id,
    status: a.status,
    check_in_method: a.check_in_method,
    checked_in_at: a.checked_in_at,
    latitude: a.latitude,
    longitude: a.longitude,
    course_name: a.course_name,
    session_time: a.session_time,
  };
}
