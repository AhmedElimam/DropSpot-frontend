import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSwapCandidates, requestSwap } from '@/api/swaps';
import { useAuthStore } from '@/stores/authStore';

function useStudentId(): number {
  const user = useAuthStore((s) => s.user);
  return user?.student_id ?? user?.id ?? 0;
}

export function useSwapCandidates(originalSessionInstanceId: number | null) {
  const studentId = useStudentId();
  return useQuery({
    queryKey: ['swap-candidates', studentId, originalSessionInstanceId],
    queryFn: () => getSwapCandidates(studentId, originalSessionInstanceId as number),
    enabled: studentId > 0 && !!originalSessionInstanceId,
  });
}

export function useRequestSwap() {
  const studentId = useStudentId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { target_session_instance_id: number; original_session_instance_id: number }) =>
      requestSwap({ student_id: studentId, ...payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['swap-candidates'] });
    },
  });
}
