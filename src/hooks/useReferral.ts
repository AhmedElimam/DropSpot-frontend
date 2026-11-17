import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activateReferralReward, getReferral } from '@/api/referral';
import { useAuthStore } from '@/stores/authStore';

export const REFERRAL_KEY = ['teacher', 'referral'] as const;

/**
 * The founding teacher's invite code, its counts and the QR-card stash. Teacher only — never an
 * assistant. `enabled` lets the app-open promo ask only when it might show.
 */
export function useReferral(enabled = true) {
  const role = useAuthStore((s) => s.role);
  return useQuery({
    queryKey: REFERRAL_KEY,
    queryFn: getReferral,
    staleTime: 5 * 60_000,
    enabled: role === 'teacher' && enabled,
  });
}

/**
 * «فعّلها الآن»: a stashed batch of cards is made and sent to print; the page reloads its stash,
 * and the teacher's cards page («كروت المدرّس») its batches.
 */
export function useActivateReferralReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => activateReferralReward(id),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: REFERRAL_KEY });
      void qc.invalidateQueries({ queryKey: ['teacher-cards'] });
    },
  });
}
