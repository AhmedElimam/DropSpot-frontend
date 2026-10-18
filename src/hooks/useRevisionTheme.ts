import { useEffect } from 'react';
import { usePathname, type Href } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useReviseMode } from '@/hooks/useReviseMode';
import { useAppConfigStore } from '@/stores/appConfigStore';

/**
 * ONE source of truth for «وضع المراجعة» on the phone (founder 2026-10-16).
 *
 *   wanted  = the super-admin flag `revise_mode` is on AND the signed-in teacher's (or the
 *             assistant's active teacher's) switch is explicitly ON, read by useReviseMode.
 *   active  = what the token layer is painted with right now (src/theme/revision.ts), set
 *             by the store — screens read THIS, never the query, so a screen and its
 *             colours can never disagree.
 *
 * `RevisionThemeSync` (mounted once, in the teacher layout) carries wanted → active: at launch
 * silently, on a flip with the curtain. Unmounting it (sign-out, another role) lifts the
 * season. Students and parents never mount it, so their app keeps its own scheme.
 */
export function useRevisionWanted(): boolean | undefined {
  const { data: flags } = useFeatureFlags();
  const { data: reviseOn } = useReviseMode();
  // Not known until the saved config is read: the bundled defaults have no flags, and acting
  // on that «off» at launch marked the sync done, so the real value a moment later looked
  // like a flip — a curtain and a rebuilt app on every cold start (founder 2026-10-18).
  const configReady = useAppConfigStore((s) => s.hydrated);
  if (!configReady) return undefined;
  if (!flags?.revise_mode) return false;
  return reviseOn === undefined ? undefined : reviseOn === true;
}

/** Is the app dressed for the season right now? Cheap: a store read. */
export function useRevisionActive(): boolean {
  return useThemeStore((s) => s.revision);
}

export function RevisionThemeSync() {
  const wanted = useRevisionWanted();
  const role = useAuthStore((s) => s.role);
  const teacherSide = role === 'teacher' || role === 'assistant';
  const pathname = usePathname();

  useEffect(() => {
    if (!teacherSide || wanted === undefined) return;
    const store = useThemeStore.getState();
    // The first known value lands silently (restored from disk or just fetched); a change
    // after that is the switch being flipped — the curtain, and back to this screen.
    const first = !synced;
    synced = true;
    if (store.revision === wanted) return;
    // The root path is ambiguous between the role groups (it is the resolve route itself),
    // so a flip from Home simply lands on Home.
    const returnTo = pathname && pathname !== '/' ? (pathname as Href) : undefined;
    store.setRevision(wanted, first ? undefined : { animate: true, returnTo });
  }, [wanted, teacherSide, pathname]);

  return null;
}

/**
 * Lifts the season on sign-out or when the signed-in role is not a teacher's. Mounted at the
 * ROOT, outside the re-keyed tree — the sync above lives inside it, and an unmount cleanup
 * there would run on every rebuild (the season's own re-key included), lift the season,
 * re-key again, and loop the app into the ground (found on the simulator 2026-10-16).
 */
export function RevisionThemeGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  useEffect(() => {
    if (isAuthenticated && (role === 'teacher' || role === 'assistant')) return;
    synced = false;
    useThemeStore.getState().setRevision(false);
  }, [isAuthenticated, role]);
  return null;
}

let synced = false;

/** Tests / sign-out: forget that a value was ever synced. */
export function resetRevisionSync(): void {
  synced = false;
}
