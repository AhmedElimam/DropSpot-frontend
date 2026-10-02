import { useEffect, useRef } from 'react';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { clearForSessionSwitch } from '@/utils/sessionCache';

/**
 * The ONE place that reacts to entering or leaving an impersonation session.
 *
 * It used to be done by whoever triggered the switch — the picker, the QR hand-off, the
 * banner's «خروج», the API client when the token died — each clearing the cache and
 * navigating on its own. They raced: «خروج» cleared the cache first, every mounted teacher
 * screen refetched with the revoked token, each 401 ran the client's own "session over"
 * path in parallel, and the app navigated twice while the session flipped under a render
 * (the crash on exit/logout, 2026-09-29). Now the store only changes the session, once,
 * and this watcher clears the cache once and navigates once.
 *
 * Order matters: clear FIRST, then navigate. The first version cleared a tick after
 * navigating, which caught the new screens' first requests in flight and left them on a
 * spinner for good (a mounted useQuery only re-attaches to a fresh query when it next
 * renders — see src/utils/sessionCache.ts). Teacher home «حصص اليوم» after entering an
 * impersonation session, founder 2026-10-01.
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

    // None of one person's cached data may survive into the other's. Now, while the only
    // mounted observers are the OLD screens (about to unmount); the sweeps catch any of
    // them that re-fetched under the new session on its way out.
    // Fire-and-forget: a second switch inside the sweep window must not cancel the first
    // one's sweeps — an unobserved polluted query is exactly what they exist to remove.
    clearForSessionSwitch(qc);
    // Into the target's app, or back to the admin's picker: `/` routes by role. An
    // impersonation that ended in a sign-out (no admin session to restore) goes straight to
    // login — it used to rely on the teacher layout's redirect, which is where the
    // «Rendered fewer hooks» crash sat, so the teacher screen stayed up instead.
    router.replace((key !== null ? '/' : '/(auth)/login') as Href);
  }, [isAuthenticated, userId, impersonating, qc]);

  return null;
}
