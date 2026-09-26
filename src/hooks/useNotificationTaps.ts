import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { notificationRouteFor } from '@/utils/notification-routing';
import { getInitialNotificationResponse, setupNotificationResponseHandler } from '@/utils/push-notifications';

// A launch-tap is asked for once per process: the OS keeps answering with the same
// response, and every tab-layout mount (a role switch, a re-login) would re-open it.
let launchTapHandled = false;

/**
 * Tapping a push opens the screen it is about — while the app is running AND when the
 * tap is what launched it. One hook for every role's tab layout; the destination comes
 * from the same table the in-app feed uses, so the two taps never disagree. `can` is
 * the assistant's ability check (omit for other roles).
 */
export function useNotificationTaps(can?: (ability: string) => boolean): void {
  const role = useAuthStore((s) => s.role);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    const open = (data: Record<string, unknown>) => {
      const route = notificationRouteFor({ role, type: String(data?.type ?? ''), data, can });
      if (route) router.push(route as never);
    };

    const sub = setupNotificationResponseHandler(open);
    if (!launchTapHandled) {
      launchTapHandled = true;
      void getInitialNotificationResponse().then((data) => { if (data) open(data); });
    }
    return () => sub.remove();
    // `can` changes identity as abilities load; the listener only reads it on a tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, role]);
}
