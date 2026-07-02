import { useQuery } from '@tanstack/react-query';
import { getChildren } from '@/api/children';

export function useChildren() {
  return useQuery({ queryKey: ['children'], queryFn: getChildren });
}
