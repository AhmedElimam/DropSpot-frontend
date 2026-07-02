import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStudentSessions, getTodayStudentSessions, getUpcomingStudentSessions } from '@/api/sessions';
import { useAuthStore } from '@/stores/authStore';
import type { SessionInstance } from '@/types/session-instance';

function useStudentId(): number {
  const user = useAuthStore((s) => s.user);
  return user?.student_id ?? user?.id ?? 0;
}

export function useTodaySessions() {
  const studentId = useStudentId();
  return useQuery({
    queryKey: ['sessions', 'today', studentId],
    queryFn: () => getTodayStudentSessions(studentId),
    enabled: studentId > 0,
    refetchInterval: 60000,
  });
}

export function useUpcomingSessions(limit = 10) {
  const studentId = useStudentId();
  return useQuery({
    queryKey: ['sessions', 'upcoming', studentId, limit],
    queryFn: () => getUpcomingStudentSessions(studentId, limit),
    enabled: studentId > 0,
  });
}

export function useStudentSessions(params?: { status?: string; from?: string; to?: string }) {
  const studentId = useStudentId();
  return useQuery({
    queryKey: ['sessions', 'list', studentId, params],
    queryFn: () => getStudentSessions(studentId, params),
    enabled: studentId > 0,
  });
}
