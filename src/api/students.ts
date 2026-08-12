import client from './client';
import { extractList, extractAttrs } from './utils';

export interface EnrollableSlot {
  id: number;
  label: string;
}

export interface EnrollableClass {
  course_id: number;
  course_name: string;
  academic_session_id: number;
  slots: EnrollableSlot[];
}

export async function getEnrollableClasses(): Promise<EnrollableClass[]> {
  const { data } = await client.get('/teacher/enrollable-classes');
  return extractList(data, 'enrollable-class').map((item: any) => {
    const a = extractAttrs(item);
    return {
      course_id: a.course_id,
      course_name: a.course_name,
      academic_session_id: a.academic_session_id,
      slots: a.slots ?? [],
    } as EnrollableClass;
  });
}

export interface LookupStudent {
  id: number;
  name: string;
  has_card: boolean;
  report_notice: boolean;
  report_notice_message: string | null;
}

export interface LookupResult {
  found: boolean;
  action?: 'use_card' | 'proceed_new';
  student?: LookupStudent | null;
  reason?: string | null;
}

// Lookup a student by scanned card (QR/serial). Existing → student; unknown → miss.
export async function lookupStudent(method: 'qr' | 'code', value: string, courseId: number): Promise<LookupResult> {
  const { data } = await client.post('/students/lookup', { method, value, course_id: courseId });
  return (data.data ?? data) as LookupResult;
}

export interface EnrollResult {
  enrollment_id: number;
  student_id: number;
  report_notice?: boolean;
}

// Enroll an existing student into the course (schedule master) from their scanned
// card. Enrollment is course-level; the home slot is auto-bound server-side when
// the course has a single weekly slot.
export async function enrollByCard(payload: {
  method: 'qr' | 'code';
  value: string;
  course_id: number;
  academic_session_id: number;
  session_schedule_id?: number;
}): Promise<EnrollResult> {
  const { data } = await client.post('/students/enroll-by-card', payload);
  return (data.data ?? data) as EnrollResult;
}

// ---------------------------------------------------------------------------
// Teacher "الطلاب" tab: roster (filter/order by grade), grades filter list, and
// a per-student profile (core + billing). All server-scoped to the teacher.
// ---------------------------------------------------------------------------

export interface RosterStudent {
  id: string;
  name: string | null;
  student_code: string | null;
  grade_id: number | null;
  grade_name: string | null;
  attendance_total: number;
  attendance_attended: number;
  attendance_rate: number | null;
}

export interface TeacherCourse {
  id: number;
  name: string;
}

export interface StudentCourse {
  id: number;
  name: string | null;
}

export interface StudentParent {
  name: string | null;
  phone: string | null;
  relationship: string | null;
  is_primary: boolean;
}

export interface StudentAttendanceRow {
  id: number;
  course_name: string | null;
  date: string | null;
  status: string;
  method: string | null;
}

export interface StudentDetail {
  id: string;
  name: string | null;
  student_code: string | null;
  grade_name: string | null;
  courses: StudentCourse[];
  parents: StudentParent[];
  attendance_stats: { total: number; attended: number; absent: number; excused: number };
  attendance: StudentAttendanceRow[];
  billing: {
    has_overdue: boolean;
    overdue_amount: string;
    override_active: boolean;
    override_expires_at: string | null;
  };
}

export async function getTeacherStudents(params?: { course_id?: number; q?: string }): Promise<RosterStudent[]> {
  const { data } = await client.get('/teacher/students', { params });
  return extractList(data, 'teacher-student').map((item: any) => {
    const attrs = extractAttrs(item);
    return { ...attrs, id: String(item.id ?? attrs.id) } as RosterStudent;
  });
}

export async function getTeacherCourses(): Promise<TeacherCourse[]> {
  const { data } = await client.get('/teacher/students/courses');
  return (data.data ?? data ?? []) as TeacherCourse[];
}

export async function getStudentDetail(id: string | number): Promise<StudentDetail> {
  const { data } = await client.get(`/teacher/students/${id}`);
  return (data.data ?? data) as StudentDetail;
}
