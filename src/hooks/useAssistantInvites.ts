import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingInvitations, acceptInvitation, rejectInvitation } from '@/api/assistantInvites';
import { useAuthStore } from '@/stores/authStore';

export function usePendingInvitations() {
  const role = useAuthStore((s) => s.role);
  return useQuery({
    queryKey: ['assistant-invitations'],
    queryFn: getPendingInvitations,
    enabled: role === 'assistant',
    staleTime: 30_000,
  });
}

export function useRespondInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'accept' | 'reject' }) =>
      action === 'accept' ? acceptInvitation(id) : rejectInvitation(id),
    onSuccess: () => {
      // Refresh pending list, and the teacher list (accepting adds a new teacher).
      qc.invalidateQueries({ queryKey: ['assistant-invitations'] });
      qc.invalidateQueries({ queryKey: ['my-teachers'] });
    },
  });
}
