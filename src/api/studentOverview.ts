import client from './client';

/** One course the student attends under a teacher, with how attendance stands there. */
export interface StudentCourseStanding {
  id: number;
  name: string;
  present: number;
  absent: number;
  excused: number;
  total: number;
  /** present ÷ recorded, as a whole percent; null before anything was recorded. */
  rate: number | null;
  next_session_at: string | null;
}

export interface StudentTeacher {
  id: number;
  name: string;
  logo_url: string | null;
  courses: StudentCourseStanding[];
  present: number;
  absent: number;
  total: number;
}

/** The student's teachers, each with their courses and per-course attendance. */
export async function getStudentTeachers(studentId: number): Promise<StudentTeacher[]> {
  const { data } = await client.get(`/students/${studentId}/teachers-overview`);
  return ((data?.data ?? []) as any[]).map((r) => ({ ...(r.attributes ?? r), id: Number(r.id ?? r.attributes?.id) }));
}

/** A past session under one teacher, in the attendance-record shape the shared row reads. */
export interface StudentTeacherPastSession {
  id: number;
  session_instance_id: number;
  student_id: number;
  status: 'present' | 'absent' | 'late' | 'excused';
  check_in_method: 'card_scan' | 'phone_permitted' | 'manual' | null;
  checked_in_at: string | null;
  course_name: string | null;
  session_time: string | null;
  teacher_name: string | null;
  teacher_id: number | null;
  type: string;
}

export interface StudentTeacherUpcoming {
  id: number;
  course_name: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  location: string | null;
  type: string;
}

export interface StudentTeacherMark {
  id: number;
  course_name: string | null;
  date: string | null;
  score: number;
  max_score: number | null;
  percentage: number;
}

export interface StudentTeacherExam {
  date: string | null;
  title: string;
  mark: number;
  max: number | null;
  pct: number | null;
  source: 'session' | 'revision';
}

/** One teacher in depth: courses, next and past sessions, sheet marks and exam results. */
export interface StudentTeacherDetail extends StudentTeacher {
  excused: number;
  upcoming: StudentTeacherUpcoming[];
  past: StudentTeacherPastSession[];
  marks: StudentTeacherMark[];
  marks_average: number | null;
  exams: StudentTeacherExam[];
}

export async function getStudentTeacherDetail(studentId: number, teacherId: number): Promise<StudentTeacherDetail> {
  const { data } = await client.get(`/students/${studentId}/teachers-overview/${teacherId}`);
  const r = data?.data ?? {};
  return { ...(r.attributes ?? r), id: Number(r.id ?? r.attributes?.id) } as StudentTeacherDetail;
}
