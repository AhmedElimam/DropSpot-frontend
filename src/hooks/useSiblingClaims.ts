import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPendingSiblingClaims, confirmSiblingClaim, denySiblingClaim } from '@/api/siblingClaims';

/** Children attached to this parent's number that still need their acknowledgement. */
export function usePendingSiblingClaims() {
  return useQuery({
    queryKey: ['sibling-claims', 'pending'],
    queryFn: getPendingSiblingClaims,
    staleTime: 30_000,
  });
}

export function useConfirmSiblingClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => confirmSiblingClaim(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sibling-claims', 'pending'] });
      qc.invalidateQueries({ queryKey: ['children'] });
    },
  });
}

export function useDenySiblingClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => denySiblingClaim(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sibling-claims', 'pending'] });
      qc.invalidateQueries({ queryKey: ['children'] });
    },
  });
}
