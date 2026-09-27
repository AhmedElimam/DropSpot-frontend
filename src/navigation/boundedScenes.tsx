import type { ReactNode } from 'react';
import { useNavigationState } from '@react-navigation/native';

/**
 * Bounded screens for the role tab navigators (older-device heat and slowdown, 2026-09-27).
 *
 * Every screen in a role — the 5–6 visible tabs AND every detail screen (a student's profile,
 * cash reconciliation, the scanner, …) — is registered as a TAB (`href: null` hides the
 * detail ones). A bottom-tab navigator never unmounts a tab once it has been opened, so on a
 * teacher's phone every screen visited since launch stayed alive: its component tree, its
 * images, and its React Query observers, which all refetched together each time the app came
 * back to the foreground. Up to 40 screens for a teacher. That is the "gets slower and hotter
 * the longer I use it" on entry-level devices.
 *
 * This keeps the visible tabs mounted (switching tabs must stay instant and keep scroll
 * position), keeps the TWO most recently visited detail screens mounted (so Back returns to
 * a screen exactly as it was left), and unmounts every older detail screen. A released screen
 * mounts again when it is opened, from the React Query cache, so it opens with data at once.
 *
 * Done as the navigator's `screenLayout`, not by moving detail screens into a Stack: no route
 * file moves, the 166 `/(role)/…` links stay valid, and the tab bar shows where it did.
 */

export const KEEP_RECENT_HIDDEN = 2;

type TabLikeState = {
  index: number;
  routes: readonly { key: string; name: string }[];
  history?: readonly { type: string; key?: string }[];
};

/**
 * Whether the route with `routeKey` should keep its content mounted.
 *
 * Relies on `backBehavior="history"` (all three role layouts): the tab router drops a route's
 * older history entry and appends it when it is focused, so `history` runs oldest → newest.
 * Anything unexpected keeps the screen mounted — unmounting by mistake loses state, keeping by
 * mistake only costs memory.
 */
export function shouldKeepMounted(
  state: TabLikeState | undefined,
  routeKey: string,
  alwaysMounted: ReadonlySet<string>,
  keepRecent: number = KEEP_RECENT_HIDDEN,
): boolean {
  if (!state) return true;
  const route = state.routes.find((r) => r.key === routeKey);
  if (!route) return true;
  if (alwaysMounted.has(route.name)) return true;

  const focusedKey = state.routes[state.index]?.key;
  if (focusedKey === routeKey) return true;

  const history = state.history;
  if (!history) return true;

  const nameOf = new Map(state.routes.map((r) => [r.key, r.name] as const));
  let kept = 0;
  for (let i = history.length - 1; i >= 0 && kept < keepRecent; i--) {
    const item = history[i];
    if (item.type !== 'route' || !item.key || item.key === focusedKey) continue;
    const name = nameOf.get(item.key);
    if (!name || alwaysMounted.has(name)) continue; // visible tabs don't use up a slot
    if (item.key === routeKey) return true;
    kept++;
  }

  return false;
}

function BoundedScene({ routeKey, alwaysMounted, children }: { routeKey: string; alwaysMounted: ReadonlySet<string>; children: ReactNode }) {
  // The selector returns a boolean, so a screen re-renders only when ITS answer changes,
  // not on every navigation.
  const keep = useNavigationState((s) => shouldKeepMounted(s as unknown as TabLikeState, routeKey, alwaysMounted));

  return keep ? <>{children}</> : null;
}

/**
 * The `screenLayout` for a role's `<Tabs>`. `alwaysMounted` = the visible tab route names.
 * Pair it with `freezeOnBlur: alwaysMounted.has(route.name)` in `screenOptions`: a frozen
 * screen defers every update — including this one's switch to `null` — so a detail screen
 * must not be frozen or it would never actually be released.
 */
export function boundedSceneLayout(alwaysMounted: ReadonlySet<string>) {
  return function BoundedSceneLayout({ route, children }: { route: { key: string }; children: ReactNode }) {
    return (
      <BoundedScene routeKey={route.key} alwaysMounted={alwaysMounted}>
        {children}
      </BoundedScene>
    );
  };
}
