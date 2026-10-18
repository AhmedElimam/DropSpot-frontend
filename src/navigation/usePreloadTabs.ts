import { useEffect, useRef } from 'react';
import { AppState, InteractionManager } from 'react-native';

/** After launch settles, how long before the first tab is built in the background. */
export const PRELOAD_START_MS = 600;
/** Gap between two tabs, so building them never lands in one long JS frame. */
export const PRELOAD_GAP_MS = 250;

type TabNavigation = { preload: (name: string) => void };
export type PreloadTabState = {
  index: number;
  routes: readonly { key: string; name: string }[];
  preloadedRouteKeys?: readonly string[];
  /** Visited routes (backBehavior="history"): a visited tab is already built. */
  history?: readonly { type: string; key?: string }[];
};

/**
 * Schedule the background build of every visible tab but the focused one: after the running
 * interactions, wait PRELOAD_START_MS, then preload one tab every PRELOAD_GAP_MS. Each timer
 * re-reads the navigator's state, so a tab the user opened meanwhile (focused, visited, or
 * already preloaded) is skipped. Nothing runs while the app is in the background. Returns a cancel.
 */
export function scheduleTabPreload(
  navigation: TabNavigation,
  read: () => { state: PreloadTabState; tabs: readonly string[] },
  isActive: () => boolean = () => AppState.currentState === 'active',
): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;

  const task = InteractionManager.runAfterInteractions(() => {
    if (cancelled) return;
    timers.push(setTimeout(() => {
      const { state, tabs } = read();
      const focused = state.routes[state.index]?.name;
      tabs.filter((n) => n !== focused).forEach((name, i) => {
        timers.push(setTimeout(() => {
          if (cancelled || !isActive()) return;
          const now = read().state;
          const route = now.routes.find((r) => r.name === name);
          if (!route || now.routes[now.index]?.key === route.key || now.preloadedRouteKeys?.includes(route.key)) return;
          if (now.history?.some((h) => h.key === route.key)) return; // visited = already built
          try {
            navigation.preload(name);
          } catch {
            // A navigator without preload: the tab simply builds on its first tap, as before.
          }
        }, i * PRELOAD_GAP_MS));
      });
    }, PRELOAD_START_MS));
  });

  return () => {
    cancelled = true;
    task?.cancel?.();
    timers.forEach(clearTimeout);
  };
}

/**
 * Build the role's visible tabs in the background, one by one, once the app has settled
 * (founder 2026-10-18: «a little empty page like a flash for a second» when routing —
 * «without sacrificing our infrastructure or performance»).
 *
 * Bottom tabs are lazy: a tab is first rendered when it is first tapped, so that first tap
 * shows the bare scene background for a frame or more while the screen builds. Turning
 * `lazy` off would build every tab at launch, on the critical path. Instead, after Home is
 * up and the interactions have finished (+0.6 s — a quick first tap after a cold start must
 * find the tab built), each remaining tab is PRELOADed (React Navigation 7) 0.25 s apart — the same work the first visit would have done, moved off
 * the moment the user is waiting. The tab router keeps preloaded screens out of the back
 * history, and an unfocused screen does not run focus effects (no ambient motion, no
 * focus refetch). Tabs a user never opens cost their first query, once.
 *
 * Once per tab navigator (mounted from NotchTabBar, which all three roles use).
 */
export function usePreloadTabs(navigation: TabNavigation, state: PreloadTabState, tabs: readonly string[]): void {
  // The latest state/tabs, read when each timer fires — not captured at mount.
  const latest = useRef({ state, tabs });
  latest.current = { state, tabs };

  useEffect(() => scheduleTabPreload(navigation, () => latest.current), [navigation]);
}
