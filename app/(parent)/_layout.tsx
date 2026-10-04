import { useEffect, useRef } from 'react';
import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/index';
import { registerForPushNotifications, unregisterPushNotifications } from '@/utils/push-notifications';
import { useNotificationTaps } from '@/hooks/useNotificationTaps';
import { ROUTE_BY_ROLE } from '@/utils/routes';

// A deep link straight to a detail screen still has the tabs underneath to go back to.
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Parent app: a STACK whose first screen is the tab bar ((tabs)/_layout). A child, reports,
 * report cards, tickets, notifications, the card order… are pushed on top of the tabs, so
 * each has the iOS edge swipe back (founder 2026-10-04). They used to be hidden tabs, which
 * have no back gesture. Pushed screens carry no tab bar, so the ticket reply box, the
 * card-order form and support compose need no bar-hiding rules any more.
 */
export default function ParentLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const role = useAuthStore((s) => s.role);
  const pushTokenRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Never while impersonating: the phone is the super-admin's. Registering would hand the
  // parent's pushes to the admin, and the unmount clean-up below would then UNregister the
  // admin's own device once their session was restored.
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  useEffect(() => {
    if (!isAuthenticated || impersonating) return;

    registerForPushNotifications().then((token) => {
      pushTokenRef.current = token;
    });

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        registerForPushNotifications().then((token) => {
          pushTokenRef.current = token;
        });
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
      if (pushTokenRef.current) {
        unregisterPushNotifications(pushTokenRef.current);
        pushTokenRef.current = null;
      }
    };
  }, [isAuthenticated, impersonating]);

  // A tapped push opens the screen it is about — while running, and when the tap is
  // what launched the app (that case never reached the old listener).
  useNotificationTaps();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Not this role's app (e.g. a super-admin whose impersonation just ended): `/` routes by role.
  if (role && role !== 'parent') {
    return <Redirect href={ROUTE_BY_ROLE} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
