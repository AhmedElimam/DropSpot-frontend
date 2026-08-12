import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator, AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { initOfflineScans } from '@/db/offlineScans';
import { colors } from '@/theme/index';

/**
 * Teacher section shell — a STACK, not the tab bar. The tabs live in the (tabs)
 * group; full-screen camera screens that must NOT show a tab bar (enroll — the
 * invite-student QR screen) are stack screens here, presented ON TOP of the tabs
 * rather than nested inside the tab navigator. That's structural: a screen outside
 * the tab group cannot render a tab bar, so no style/visibility trick is involved.
 *
 * The auth gate and offline-buffer bootstrap live here so they cover the tabs and
 * the stack screens alike (a scan buffered from a full-screen screen still counts).
 */
export default function TeacherLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Ensure the offline buffer table exists, seed the pending count, and refresh
  // it whenever the app returns to the foreground (a chance to reconcile).
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    initOfflineScans().then(() => {
      if (active) useOfflineStore.getState().refresh();
    });
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') useOfflineStore.getState().refresh();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [isAuthenticated]);

  // Connectivity: drive the offline/online UI indicator only. Reconnecting does
  // NOT trigger any sync — reconciliation is teacher-initiated, full stop.
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      useOfflineStore.getState().setOnline(online);
    });
    return () => unsub();
  }, [isAuthenticated]);

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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* Invite-student QR scanner — full screen, on top of the tabs, no tab bar. */}
      <Stack.Screen name="enroll" />
    </Stack>
  );
}
