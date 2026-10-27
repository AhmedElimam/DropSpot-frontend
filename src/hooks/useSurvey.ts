import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPendingSurvey, markSurveyShown, respondSurvey, snoozeSurvey } from '@/api/surveys';
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
    // A pending survey is checked at open and every 15 min — not on every return to the app.
    staleTime: 15 * 60_000,
  });
}

/** The push and feed row a survey's publication sends (backend AnnounceSurvey). */
export const SURVEY_NOTIFICATION = 'survey';

/** A tapped survey notification asks again at once, so the root SurveyModal shows it now
 *  instead of after the 15-minute check. */
export function useOpenSurveyNotification(): () => void {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: ['pending-survey'] }); };
}

export function useMarkSurveyShown() {
  return useMutation({ mutationFn: (id: string) => markSurveyShown(id) });
}

/** «لاحقًا» — it used to hide the survey only until the app reopened (founder 2026-10-26: «it
 *  still shows every time I reopen the app»); the server now keeps it away for 24 hours. */
export function useSnoozeSurvey() {
  return useMutation({ mutationFn: (id: string) => snoozeSurvey(id) });
}

export function useRespondSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: Record<string, string> }) => respondSurvey(id, answers),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-survey'] }),
  });
}
