import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getTeacherStudents, getTeacherCourses, getStudentDetail } from '@/api/students';

export function useTeacherStudents(params?: { course_id?: number; q?: string }) {
  return useQuery({
    queryKey: ['teacher-students', params?.course_id ?? null, params?.q ?? ''],
    queryFn: () => getTeacherStudents(params),
    staleTime: 30_000,
    // Switching the course chip keeps the current list on screen (dimmed) until the new
    // one lands, instead of blanking to a spinner on every tap.
    placeholderData: keepPreviousData,
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
