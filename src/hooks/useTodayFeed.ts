import { useQuery } from '@tanstack/react-query';
import { useOnScreen } from '@/hooks/useAmbientMotion';
import { getTodayFeed } from '@/api/feed';

export function useTodayFeed() {
  const onScreen = useOnScreen();
  return useQuery({
    queryKey: ['today-feed'],
    queryFn: getTodayFeed,
    refetchInterval: onScreen ? 60000 : false, // only while the feed is in front of you
  });
}
