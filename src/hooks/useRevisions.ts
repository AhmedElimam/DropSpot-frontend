import { useQuery } from '@tanstack/react-query';
import { getRevisions } from '@/api/revisions';

/** Active revision sessions the teacher can scan into (with each one's nearest slot). */
export function useRevisions() {
  return useQuery({
    queryKey: ['revisions-active'],
    queryFn: getRevisions,
    staleTime: 30_000,
  });
}
