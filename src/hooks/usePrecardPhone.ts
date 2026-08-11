import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPendingPrecardPhone,
  acceptPrecardPhone,
  rejectPrecardPhone,
} from '@/api/precardPhone';

/** §3 — the signed-in parent's pending phone pre-card invitations. */
export function usePendingPrecardInvites() {
  return useQuery({
    queryKey: ['precard-phone', 'pending'],
    queryFn: getPendingPrecardPhone,
    staleTime: 30_000,
  });
}

export function useAcceptPrecardInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => acceptPrecardPhone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precard-phone', 'pending'] });
      qc.invalidateQueries({ queryKey: ['children'] });
    },
  });
}

export function useRejectPrecardInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => rejectPrecardPhone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['precard-phone', 'pending'] }),
  });
}
