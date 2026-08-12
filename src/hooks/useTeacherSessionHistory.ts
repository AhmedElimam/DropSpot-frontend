import { useQuery } from '@tanstack/react-query';
import { getTeacherSessions, getSessionDetail } from '@/api/teacherSessions';

export function useTeacherSessionHistory(status?: string) {
  return useQuery({
    queryKey: ['teacher-session-history', status ?? 'all'],
    queryFn: () => getTeacherSessions({ status: status || undefined }),
    staleTime: 30_000,
  });
}

export function useSessionDetail(id?: string) {
  return useQuery({
    queryKey: ['teacher-session-detail', id],
    queryFn: () => getSessionDetail(id!),
    enabled: !!id,
  });
}
