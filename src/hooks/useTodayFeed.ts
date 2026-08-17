import { useQuery } from '@tanstack/react-query';
import { getTodayFeed } from '@/api/feed';

export function useTodayFeed() {
  return useQuery({
    queryKey: ['today-feed'],
    queryFn: getTodayFeed,
    refetchInterval: 60000,
  });
}
