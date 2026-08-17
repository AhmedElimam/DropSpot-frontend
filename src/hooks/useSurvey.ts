import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPendingSurvey, markSurveyShown, respondSurvey } from '@/api/surveys';
import { useAuthStore } from '@/stores/authStore';

/**
 * The pending survey for the signed-in user, checked on app-open/login. Disabled
 * while impersonating so a super-admin support session never burns (or answers)
 * the impersonated user's survey.
 */
export function usePendingSurvey() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const impersonating = useAuthStore((s) => s.impersonation?.active);
  return useQuery({
    queryKey: ['pending-survey'],
    queryFn: getPendingSurvey,
    enabled: isAuthenticated && !impersonating,
    staleTime: 0,
  });
}

export function useMarkSurveyShown() {
  return useMutation({ mutationFn: (id: string) => markSurveyShown(id) });
}

export function useRespondSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: Record<string, string> }) => respondSurvey(id, answers),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-survey'] }),
  });
}
