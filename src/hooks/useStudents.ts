import { useQuery } from '@tanstack/react-query';
import { getTeacherStudents, getTeacherCourses, getStudentDetail } from '@/api/students';

export function useTeacherStudents(params?: { course_id?: number; q?: string }) {
  return useQuery({
    queryKey: ['teacher-students', params?.course_id ?? null, params?.q ?? ''],
    queryFn: () => getTeacherStudents(params),
    staleTime: 30_000,
  });
}

export function useTeacherCourses() {
  return useQuery({
    queryKey: ['teacher-courses'],
    queryFn: getTeacherCourses,
    staleTime: 300_000,
  });
}

export function useStudentDetail(id?: string) {
  return useQuery({
    queryKey: ['teacher-student', id],
    queryFn: () => getStudentDetail(id!),
    enabled: !!id,
  });
}
