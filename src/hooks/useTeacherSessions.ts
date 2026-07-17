import { useQuery } from '@tanstack/react-query';
import { getTeacherTodaySessions } from '@/api/teacher';

export function useTeacherTodaySessions() {
  return useQuery({
    queryKey: ['teacher-sessions-today'],
    queryFn: getTeacherTodaySessions,
    staleTime: 60_000,
  });
}
