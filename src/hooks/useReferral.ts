import { useQuery } from '@tanstack/react-query';
import { getReferral } from '@/api/referral';
import { useAuthStore } from '@/stores/authStore';

/** The founding teacher's invite code and its counts. Teacher only — never an assistant. */
export function useReferral() {
  const role = useAuthStore((s) => s.role);
  return useQuery({
    queryKey: ['teacher', 'referral'],
    queryFn: getReferral,
    staleTime: 5 * 60_000,
    enabled: role === 'teacher',
  });
}
