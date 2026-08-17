import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOnboarding, markOnboardingStep, type OnboardingState } from '@/api/onboarding';
import { useAuthStore } from '@/stores/authStore';

const TEACHER = 3;

/** Onboarding state, fetched on login for teachers only (assistants are 403'd server-side). */
export function useTeacherOnboarding() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['teacher-onboarding'],
    queryFn: getOnboarding,
    enabled: isAuthenticated && user?.user_type_id === TEACHER,
    staleTime: 0,
  });
}

export function useMarkOnboardingStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markOnboardingStep,
    onSuccess: (state: OnboardingState) => {
      qc.setQueryData(['teacher-onboarding'], state);
    },
  });
}
