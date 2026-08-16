import client from './client';
import { extractList, extractAttrs } from './utils';

/**
 * A course in which a student is at auto-termination risk — a run of consecutive
 * unexcused absences the teacher may act on. A calm early warning; the teacher still
 * has to confirm any drop.
 */
export interface AttendanceRisk {
  student_id: number;
  student_name?: string | null;
  course_name?: string | null;
  teacher_name?: string | null;
  absences: number;
  last_absent_at?: string | null;
}

function mapRisk(data: any): AttendanceRisk[] {
  return extractList(data, 'attendance-risk').map((item: any) => extractAttrs(item));
}

/** Student: the logged-in student's own at-risk courses. */
export async function getStudentAttendanceRisk(): Promise<AttendanceRisk[]> {
  const { data } = await client.get('/students/attendance-risk');
  return mapRisk(data);
}

/** Parent: at-risk courses across all the parent's children. */
export async function getParentAttendanceRisk(): Promise<AttendanceRisk[]> {
  const { data } = await client.get('/parents/attendance-risk');
  return mapRisk(data);
}
