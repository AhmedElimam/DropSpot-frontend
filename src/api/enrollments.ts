import client from './client';
import type { Enrollment } from '@/types/enrollment';

export async function getStudentEnrollments(studentId: number): Promise<Enrollment[]> {
  const { data } = await client.get(`/students/${studentId}/enrollments`);
  return data.data?.map(extract) ?? [];
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
