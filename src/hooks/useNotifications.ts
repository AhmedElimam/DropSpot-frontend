import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, getUnreadCount, markRead, markAllRead } from '@/api/notifications';
import { UNREAD_POLL_MS } from '@/api/queryFocus';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(),
  });
}

const FEED_PAGE = 20;

/**
 * The feed, page by page. The API returns no "total" — a page shorter than the size is
 * the last one. Same cache prefix as everything else here, so marking a row read
 * refreshes the pages and the bell count together.
 */
export function useNotificationsFeed() {
  return useInfiniteQuery({
    queryKey: ['notifications', 'feed'],
    queryFn: ({ pageParam }) => getNotifications({ page: pageParam, per_page: FEED_PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.length < FEED_PAGE ? undefined : pages.length + 1),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    // Every 2 minutes, not 30 s: a push already announces anything new, the badge is a
    // backstop. Each poll wakes the radio and re-renders the home tab (src/api/queryFocus.ts).
    refetchInterval: UNREAD_POLL_MS,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}
