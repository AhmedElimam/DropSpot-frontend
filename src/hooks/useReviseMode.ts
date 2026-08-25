import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getReviseMode, setReviseMode } from '@/api/reviseMode';

/** Current on/off of the special/exam-session switch for the active teacher context. */
export function useReviseMode() {
  return useQuery({
    queryKey: ['revise-mode'],
    queryFn: getReviseMode,
    staleTime: 60_000,
  });
}

/** Flip the switch; refreshes the cached value so gated entries appear/disappear at once. */
export function useSetReviseMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setReviseMode,
    onSuccess: (enabled) => {
      qc.setQueryData(['revise-mode'], enabled);
    },
  });
}
