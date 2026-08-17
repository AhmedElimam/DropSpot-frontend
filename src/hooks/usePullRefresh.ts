import { useState } from 'react';

/**
 * One consistent pull-to-refresh for the whole app. Pass every refetch function a
 * screen depends on; the spinner stays until ALL of them settle (not just the
 * first), so a pull always performs a FULL refresh — fixing the old bug where
 * `refreshing` tracked a single query and stopped early while others were stale.
 *
 * Usage:
 *   const { refreshing, onRefresh } = usePullRefresh(refetchA, refetchB);
 *   <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
 */
export function usePullRefresh(...refetchers: Array<() => Promise<unknown>>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Settle-all: one slow query no longer leaves the others un-refreshed, and a
      // single failure never wedges the spinner (allSettled, then always clear).
      await Promise.allSettled(refetchers.map((r) => r()));
    } finally {
      setRefreshing(false);
    }
  };

  return { refreshing, onRefresh };
}
