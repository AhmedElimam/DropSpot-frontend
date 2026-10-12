import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOnScreen } from '@/hooks/useAmbientMotion';
import { getStudentSessions, getTodayStudentSessions, getUpcomingStudentSessions } from '@/api/sessions';
import { useAuthStore } from '@/stores/authStore';
import type { SessionInstance } from '@/types/session-instance';

function useStudentId(): number {
  const user = useAuthStore((s) => s.user);
  return user?.student_id ?? user?.id ?? 0;
}

export function useTodaySessions() {
  const studentId = useStudentId();
  const onScreen = useOnScreen();
  return useQuery({
    queryKey: ['sessions', 'today', studentId],
    queryFn: () => getTodayStudentSessions(studentId),
    enabled: studentId > 0,
    // Polled only while the screen using it is in front: the home and check-in tabs both use
    // it and stay mounted, so each used to poll on its own, hidden or not.
    refetchInterval: onScreen ? 60000 : false,
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
