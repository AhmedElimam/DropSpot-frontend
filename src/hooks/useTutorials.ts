import { useQuery } from '@tanstack/react-query';
import { getTutorials } from '@/api/tutorials';
import { useAuthStore } from '@/stores/authStore';

/** «شروحات» for this teacher. Assistants get none yet (their app hides much of what they show). */
export function useTutorials() {
  const role = useAuthStore((s) => s.role);
  return useQuery({
    queryKey: ['tutorials', role],
    queryFn: getTutorials,
    staleTime: 60 * 60 * 1000,
    enabled: role === 'teacher',
  });
}
