import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCourses,
  getCourseDetail,
  getCourseFormOptions,
  createCourse,
  updateCourseSettings,
  updateCourseLocation,
  removeCourseSchedule,
  deleteCourse,
  type CourseDetail,
  type CourseSettingsPayload,
  type CreateCoursePayload,
  type LocationPayload,
} from '@/api/courses';

export function useCourses() {
  return useQuery({ queryKey: ['teacher-courses'], queryFn: getCourses, staleTime: 30_000 });
}

export function useCourseFormOptions() {
  return useQuery({ queryKey: ['course-form-options'], queryFn: getCourseFormOptions, staleTime: 5 * 60_000 });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCoursePayload) => createCourse(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-courses'] }),
  });
}

export function useCourseDetail(id?: string) {
  return useQuery({
    queryKey: ['teacher-course', id],
    queryFn: () => getCourseDetail(id!),
    enabled: !!id,
  });
}

/** Shared cache write: refresh both the detail and the list after any course mutation. */
function useSyncCourse(id?: string) {
  const qc = useQueryClient();
  return (fresh: CourseDetail) => {
    qc.setQueryData(['teacher-course', id], fresh);
    qc.invalidateQueries({ queryKey: ['teacher-courses'] });
  };
}

export function useUpdateCourseSettings(id: string) {
  const sync = useSyncCourse(id);
  return useMutation({
    mutationFn: (payload: CourseSettingsPayload) => updateCourseSettings(id, payload),
    onSuccess: sync,
  });
}

export function useUpdateCourseLocation(id: string) {
  const sync = useSyncCourse(id);
  return useMutation({
    mutationFn: (payload: LocationPayload) => updateCourseLocation(id, payload),
    onSuccess: sync,
  });
}

export function useRemoveSchedule(courseId: string) {
  const sync = useSyncCourse(courseId);
  return useMutation({
    mutationFn: (scheduleId: string) => removeCourseSchedule(courseId, scheduleId),
    onSuccess: sync,
  });
}

/** Hard-delete the whole course; refresh the courses list on success. */
export function useDeleteCourse(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteCourse(courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}
