import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAttendanceRecords, checkIn as checkInApi, submitExcuse, getStudentCoverage } from '@/api/attendance';
import { useAuthStore } from '@/stores/authStore';
import type { AttendanceRecord } from '@/types/attendance';

function useStudentId(): number {
  const user = useAuthStore((s) => s.user);
  return user?.student_id ?? user?.id ?? 0;
}

export function useAttendanceRecords(params?: { from?: string; to?: string }) {
  const studentId = useStudentId();
  return useQuery({
    queryKey: ['attendance', studentId, params],
    queryFn: () => getAttendanceRecords(studentId, params),
    enabled: studentId > 0,
  });
}

export function useCheckIn() {
  const studentId = useStudentId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionInstanceId, latitude, longitude, accuracy }: { sessionInstanceId: number; latitude?: number; longitude?: number; accuracy?: number }) =>
      checkInApi(sessionInstanceId, studentId, latitude, longitude, accuracy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useSubmitExcuse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ attendanceRecordId, reason }: { attendanceRecordId: number; reason: string }) =>
      submitExcuse(attendanceRecordId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

export function useCoverageStats() {
  const studentId = useStudentId();

  return useQuery({
    queryKey: ['attendance', 'stats', studentId],
    queryFn: () => getStudentCoverage(studentId),
    enabled: studentId > 0,
  });
}
