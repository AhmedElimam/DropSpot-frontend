import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { routePattern, setAnalyticsEnabled, setAnalyticsRole, trackScreen } from '@/lib/analytics';

/**
 * Renders nothing. Reports the screen on show as a route pattern (ids stripped — see
 * src/lib/analytics.ts), the signed-in person's role, and switches collection off while a
 * super-admin is impersonating (and back on after).
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.role);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const last = useRef<string | null>(null);

  useEffect(() => {
    setAnalyticsEnabled(!impersonating);
  }, [impersonating]);

  useEffect(() => {
    if (!impersonating) setAnalyticsRole(role ?? null);
  }, [role, impersonating]);

  useEffect(() => {
    const route = routePattern(pathname ?? '/');
    if (route === last.current) return;
    last.current = route;
    trackScreen(route);
  }, [pathname]);

  return null;
}
