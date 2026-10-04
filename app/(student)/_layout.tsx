import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator, AppState, type AppStateStatus } from 'react-native';
import { registerForPushNotifications } from '@/utils/push-notifications';
import { useNotificationTaps } from '@/hooks/useNotificationTaps';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/index';
import { ROUTE_BY_ROLE } from '@/utils/routes';

// A deep link straight to a detail screen still has the tabs underneath to go back to.
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Student app: a STACK whose first screen is the tab bar ((tabs)/_layout). Marks, the
 * attendance record, a teacher's page, swap, the card order, notifications and support are
 * pushed on top of the tabs, so each has the iOS edge swipe back (founder 2026-10-04). They
 * used to be hidden tabs, which have no back gesture.
 */
export default function StudentLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const role = useAuthStore((s) => s.role);

  // The student's phone never registered for push, so grades, invoices, card status and
  // the parent-unreachable nudge only ever reached the in-app inbox. Same wiring as the
  // teacher layout; a tapped push then opens the screen it is about.
  // Never while impersonating — the phone is the super-admin's.
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  useEffect(() => {
    if (!isAuthenticated || impersonating) return;
    registerForPushNotifications();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') registerForPushNotifications();
    });
    return () => sub.remove();
  }, [isAuthenticated, impersonating]);
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
  if (role && role !== 'student') {
    return <Redirect href={ROUTE_BY_ROLE} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
