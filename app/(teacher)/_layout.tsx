import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View, Text, ActivityIndicator, AppState, type AppStateStatus } from 'react-native';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { initOfflineScans } from '@/db/offlineScans';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * Teacher (and assistant) app — a 5-tab bar (home · camera · students · tickets ·
 * settings), deliberately separate from the parent/student navigation.
 *
 * The invite-student camera screen (`enroll`) is a full-screen route: it's reached
 * by push (never a tab button) and hides the bar via the custom `tabBar` below —
 * react-navigation's own render hook returns NOTHING for that route, so the bar
 * component is simply not mounted there (not a style override). Every actual tab —
 * scan/Camera included — renders the normal bar.
 */
const labels: Record<string, string> = {
  index: 'teacher.tab_home',
  scan: 'teacher.tab_camera',
  students: 'teacher.tab_students',
  tickets: 'teacher.tab_tickets',
  settings: 'teacher.tab_settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  scan: 'scan',
  students: 'children',
  tickets: 'tickets',
  settings: 'settings',
};

// Top-level routes that must never show the tab bar (reached by push, not tabs).
const FULLSCREEN_ROUTES = ['enroll'];

// Decide whether the bar should be hidden for the currently-focused tab. Hidden on
// the invite scanner (enroll) and on an open ticket conversation (tickets/[id]),
// where the reply box + keyboard need the whole screen. The ticket LIST keeps the bar.
function shouldHideBar(state: { routes: { name: string; state?: unknown }[]; index: number }): boolean {
  const tab = state.routes[state.index];
  if (!tab) return false;
  if (FULLSCREEN_ROUTES.includes(tab.name)) return true;
  if (tab.name === 'tickets') {
    const nested = tab.state as { routes?: { name: string }[]; index?: number } | undefined;
    const nestedName = nested?.routes?.[nested?.index ?? 0]?.name;
    return nestedName === '[id]';
  }
  return false;
}

export default function TeacherTabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const pending = useOfflineStore((s) => s.pending);

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
    <Tabs
      // Render NO bar on full-screen surfaces (invite scanner, open ticket) by not
      // mounting the bar component for them. Every real tab shows the bar.
      tabBar={(props) => {
        if (shouldHideBar(props.state)) return null;
        return <BottomTabBar {...props} />;
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: 10 + insets.bottom,
          height: 64 + insets.bottom,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          ...shadows.glow,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
        },
        tabBarLabel: ({ focused }) => {
          const labelKey = labels[route.name];
          return labelKey ? (
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 12,
                color: focused ? colors.primary : colors.textTertiary,
                marginTop: 2,
              }}
            >
              {t(labelKey)}
            </Text>
          ) : null;
        },
        tabBarIcon: ({ focused }) => (
          <View style={{ opacity: focused ? 1 : 0.55, transform: [{ scale: focused ? 1.08 : 1 }] }}>
            <Icon
              name={icons[route.name] || 'home'}
              size={24}
              color={focused ? colors.primary : colors.textTertiary}
              outline={!focused}
            />
          </View>
        ),
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen
        name="scan"
        options={{ tabBarBadge: pending > 0 ? pending : undefined }}
      />
      <Tabs.Screen name="students" />
      <Tabs.Screen name="tickets" />
      <Tabs.Screen name="settings" />
      {/* Reconciliation is reached from the pending badge / Home, not a tab. */}
      <Tabs.Screen name="reconcile" options={{ href: null }} />
      {/* Enroll-by-card (invite student) — pushed from Home; full screen, no bar. */}
      <Tabs.Screen name="enroll" options={{ href: null }} />
      {/* Revision-session picker → scan tab in revision mode. Not a tab. */}
      <Tabs.Screen name="revisions" options={{ href: null }} />
      {/* Payment kind picker → scan tab in payment mode. Not a tab. */}
      <Tabs.Screen name="collect" options={{ href: null }} />
      {/* Grant a billing exception — searched from Home, not a tab. */}
      <Tabs.Screen name="grant-exception" options={{ href: null }} />
    </Tabs>
  );
}
