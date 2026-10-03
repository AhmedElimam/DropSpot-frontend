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
