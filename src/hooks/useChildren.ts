import { useQuery } from '@tanstack/react-query';
import { getChildren } from '@/api/children';

export function useChildren(enabled = true) {
  return useQuery({ queryKey: ['children'], queryFn: getChildren, enabled });
}
