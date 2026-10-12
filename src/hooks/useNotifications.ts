import { useQuery, useInfiniteQuery, useMutation, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { useOnScreen } from '@/hooks/useAmbientMotion';
import { getNotifications, getUnreadCount, markRead, markAllRead, markUnread, dismissNotification, restoreNotification, type Notification } from '@/api/notifications';
import { UNREAD_POLL_MS } from '@/api/queryFocus';

/** The newest notification only (the parent home shows one) — not the whole list. */
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: () => getNotifications({ page: 1, per_page: 1 }),
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
  const onScreen = useOnScreen();
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    // Every 2 minutes, not 30 s: a push already announces anything new, the badge is a
    // backstop. Each poll wakes the radio and re-renders the home tab (src/api/queryFocus.ts).
    refetchInterval: onScreen ? UNREAD_POLL_MS : false, // the home tab stays mounted under every other screen
  });
}

const FEED_KEY = ['notifications', 'feed'] as const;
const COUNT_KEY = ['notifications', 'unread-count'] as const;
const LATEST_KEY = ['notifications', 'latest'] as const;

/**
 * Patch the feed in place so a swipe lands at once (the row flips or leaves under the
 * finger) instead of waiting a round trip; rolled back if the server says no.
 */
function optimistic(qc: QueryClient, edit: (rows: Notification[]) => Notification[], countDelta: (rows: Notification[]) => number) {
  return async () => {
    await qc.cancelQueries({ queryKey: FEED_KEY });
    const feed = qc.getQueryData<InfiniteData<Notification[]>>(FEED_KEY);
    const count = qc.getQueryData<number>(COUNT_KEY);
    if (feed) {
      const delta = countDelta(feed.pages.flat());
      qc.setQueryData<InfiniteData<Notification[]>>(FEED_KEY, { ...feed, pages: feed.pages.map(edit) });
      if (typeof count === 'number') qc.setQueryData<number>(COUNT_KEY, Math.max(0, count + delta));
    }
    return { feed, count };
  };
}

/**
 * After a swipe: the optimistic patch already shows the right rows, so only the badge count and
 * the one «latest» row are re-asked. Invalidating the whole ['notifications'] prefix re-fetched
 * EVERY loaded page of the feed one after another on every swipe (founder 2026-10-09: «light on
 * all devices»). A failed swipe re-syncs everything.
 */
function settle(qc: QueryClient) {
  return (_d: unknown, error: unknown) => {
    if (error) { qc.invalidateQueries({ queryKey: ['notifications'] }); return; }
    qc.invalidateQueries({ queryKey: COUNT_KEY });
    qc.invalidateQueries({ queryKey: LATEST_KEY });
  };
}

function rollback(qc: QueryClient) {
  return (_e: unknown, _v: unknown, ctx?: { feed?: InfiniteData<Notification[]>; count?: number }) => {
    if (ctx?.feed) qc.setQueryData(FEED_KEY, ctx.feed);
    if (typeof ctx?.count === 'number') qc.setQueryData(COUNT_KEY, ctx.count);
  };
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onMutate: (id: number) => optimistic(qc,
      (rows) => rows.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      (all) => (all.some((n) => n.id === id && !n.is_read) ? -1 : 0))(),
    onError: rollback(qc),
    onSettled: settle(qc),
  });
}

export function useMarkUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markUnread,
    onMutate: (id: number) => optimistic(qc,
      (rows) => rows.map((n) => (n.id === id ? { ...n, is_read: false } : n)),
      (all) => (all.some((n) => n.id === id && n.is_read) ? 1 : 0))(),
    onError: rollback(qc),
    onSettled: settle(qc),
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: dismissNotification,
    onMutate: (id: number) => optimistic(qc,
      (rows) => rows.filter((n) => n.id !== id),
      (all) => (all.some((n) => n.id === id && !n.is_read) ? -1 : 0))(),
    onError: rollback(qc),
    onSettled: settle(qc),
  });
}

export function useRestoreNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreNotification,
    onSettled: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}
