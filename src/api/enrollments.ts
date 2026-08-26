import client from './client';
import type { Enrollment } from '@/types/enrollment';

export async function getStudentEnrollments(studentId: number): Promise<Enrollment[]> {
  const { data } = await client.get(`/students/${studentId}/enrollments`);
  const items = data.data ?? data.enrollments ?? data;
  return Array.isArray(items) ? items.map(extract) : [];
}

// Soft-terminate (drop) an enrollment — mobile parity for the web action. History
// and past billing are untouched; only future delivery/roster/capacity stop counting.
export async function terminateEnrollment(enrollmentId: number): Promise<void> {
  await client.post(`/teacher/enrollments/${enrollmentId}/terminate`);
}

// Move one student to another of the teacher's OWN courses (drops this enrollment,
// creates a fresh one under the destination). A cross-grade move throws a 422 with
// code 'GRADE_MISMATCH' first; re-call with acceptGradeMismatch=true to confirm it.
export async function transferEnrollment(
  enrollmentId: number,
  toCourseId: number,
  acceptGradeMismatch = false,
): Promise<void> {
  await client.post(`/teacher/enrollments/${enrollmentId}/transfer`, {
    to_course_id: toCourseId,
    accept_grade_mismatch: acceptGradeMismatch,
  });
}

function extract(item: any): Enrollment {
  const a = item.attributes ?? item;
  return {
    id: parseInt(item.id, 10),
    student_id: a.student_id,
    course_id: a.course_id,
    teacher_id: a.teacher_id,
    academic_session_id: a.academic_session_id,
    status: a.status,
    enrolled_at: a.enrolled_at,
    course: a.course,
    teacher: a.teacher,
  };
}
