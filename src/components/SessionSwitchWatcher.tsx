import { useEffect, useRef } from 'react';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

/**
 * The ONE place that reacts to entering or leaving an impersonation session.
 *
 * It used to be done by whoever triggered the switch — the picker, the QR hand-off, the
 * banner's «خروج», the API client when the token died — each clearing the cache and
 * navigating on its own. They raced: «خروج» cleared the cache first, every mounted teacher
 * screen refetched with the revoked token, each 401 ran the client's own "session over"
 * path in parallel, and the app navigated twice while the session flipped under a render
 * (the crash on exit/logout, 2026-09-29). Now the store only changes the session, once,
 * and this watcher navigates once and clears the cache after the old screens are gone.
 *
 * Ordinary sign-in and sign-out are left alone: their screens and the role layouts
 * already route them.
 */
export function SessionSwitchWatcher() {
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const key = isAuthenticated ? `${userId}:${impersonating ? 'imp' : 'own'}` : null;
    const was = previous.current;
    previous.current = key;
    // The first value after hydration is where the app already is — nothing switched.
    if (was === undefined || was === key) return;
    // Only an impersonation boundary is ours to route.
    if (!(was?.endsWith(':imp') || key?.endsWith(':imp'))) return;

    if (key !== null) {
      // Into the target's app, or back to the admin's picker: `/` routes by role.
      router.replace('/' as Href);
    }
    // After the old screens have unmounted, so none of them refetches under the new
    // session. None of one person's cached data may survive into the other's.
    setTimeout(() => qc.clear(), 0);
  }, [isAuthenticated, userId, impersonating, qc]);

  return null;
}
