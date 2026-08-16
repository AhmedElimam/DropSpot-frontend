import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View, Text, ActivityIndicator, AppState, type AppStateStatus } from 'react-native';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, stampTeacherId } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { initOfflineScans } from '@/db/offlineScans';
import { syncScheduleCacheOnOpen } from '@/db/scheduleCache';
import { registerForPushNotifications } from '@/utils/push-notifications';
import { RelocationPrompt } from '@/components/teacher/RelocationPrompt';
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
  manage: 'teacher.tab_manage',
  tickets: 'teacher.tab_tickets',
  settings: 'teacher.tab_settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  scan: 'scan',
  students: 'children',
  manage: 'book',
  tickets: 'tickets',
  settings: 'settings',
};

// Top-level routes that must never show the tab bar. Any live CAMERA screen is
// full-screen so the bar never overlaps the camera controls: the invite scanner
// (enroll) and the attendance scanner (scan) — both exit via their own in-screen
// close button, so hiding the bar never traps the user.
const FULLSCREEN_ROUTES = ['enroll', 'scan'];

// Decide whether the bar should be hidden for the currently-focused tab. Hidden on
// the camera screens (scan, enroll) and on an open ticket conversation (tickets/[id]),
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
  const role = useAuthStore((s) => s.role);
  const pending = useOfflineStore((s) => s.pending);
  const rejected = useOfflineStore((s) => s.rejected);
  // Badge = everything still unfinished: scans waiting to sync AND scans the
  // server rejected that need a decision (addendum §2).
  const needsAttention = pending + rejected;

  // Ensure the offline buffer table exists, seed the pending count, and refresh
  // it whenever the app returns to the foreground (a chance to reconcile).
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    initOfflineScans().then(() => {
      if (active) useOfflineStore.getState().refresh();
    });
    // Part 2: on open, enforce the date staleness guard and refresh the ACTIVE
    // teacher's schedule entry when online. Fire-and-forget — never blocks the UI,
    // and a failure just leaves the guard to fall back to manual reconciliation.
    syncScheduleCacheOnOpen(useOfflineStore.getState().online, stampTeacherId(useAuthStore.getState()));
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') {
        useOfflineStore.getState().refresh();
        syncScheduleCacheOnOpen(useOfflineStore.getState().online, stampTeacherId(useAuthStore.getState()));
      }
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [isAuthenticated]);

  // Register this device's push token so teacher notifications (daily financial
  // report, admin-ticket replies, etc.) can be delivered via FCM. Previously this
  // was wired only in the parent layout, so teachers had no tokens. Fire-and-forget;
  // a permission denial or iOS APNs limitation just yields no token (in-app inbox
  // still works). Re-run on foreground so a later permission grant is picked up.
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotifications();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') registerForPushNotifications();
    });
    return () => sub.remove();
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
    <>
    {/* Relocation prompt — teachers only (assistants never edit geofence anchors). */}
    {isAuthenticated && role === 'teacher' ? <RelocationPrompt enabled /> : null}
    <Tabs
      // Render NO bar on full-screen surfaces (invite scanner, open ticket) by not
      // mounting the bar component for them. Every real tab shows the bar.
      tabBar={(props) => {
        if (shouldHideBar(props.state)) return null;
        return <BottomTabBar {...props} />;
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        // Consistent scene background so a tab switch never flashes a white frame
        // between two screens (e.g. the black scanner and a cream screen).
        sceneStyle: { backgroundColor: colors.background },
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
        options={{ tabBarBadge: needsAttention > 0 ? needsAttention : undefined }}
      />
      <Tabs.Screen name="students" />
      {/* Management hub — courses, location, schedule tools. */}
      <Tabs.Screen name="manage" />
      <Tabs.Screen name="tickets" />
      <Tabs.Screen name="settings" />
      {/* Reconciliation is reached from the pending badge / Home, not a tab. */}
      <Tabs.Screen name="resolution" options={{ href: null }} />
      {/* Insights — pushed from the manage hub, not a tab. */}
      <Tabs.Screen name="insights" options={{ href: null }} />
      {/* Order a card for an existing enrollment — pushed from the roster cards segment. */}
      <Tabs.Screen name="card-order-new" options={{ href: null }} />
      <Tabs.Screen name="reconcile" options={{ href: null }} />
      {/* Enroll-by-card (invite student) — pushed from Home; full screen, no bar. */}
      <Tabs.Screen name="enroll" options={{ href: null }} />
      {/* Revision-session picker → scan tab in revision mode. Not a tab. */}
      <Tabs.Screen name="revisions" options={{ href: null }} />
      {/* Merged-exam mark entry — pushed from the revisions list, not a tab. */}
      <Tabs.Screen name="revision-marks" options={{ href: null }} />
      {/* Payment kind picker → scan tab in payment mode. Not a tab. */}
      <Tabs.Screen name="collect" options={{ href: null }} />
      {/* Grant a billing exception — searched from Home, not a tab. */}
      <Tabs.Screen name="grant-exception" options={{ href: null }} />
      {/* Add a weekly schedule slot — pushed from the sessions segment, not a tab. */}
      <Tabs.Screen name="schedule-new" options={{ href: null }} />
      {/* Courses management (settings · GPS location · weekly slots) — from Settings. */}
      <Tabs.Screen name="courses" options={{ href: null }} />
      {/* Pause a date range (bulk-cancel) — from the sessions segment, not a tab. */}
      <Tabs.Screen name="pause" options={{ href: null }} />
      {/* Schedule tools — merge two slots, Ramadan time overrides. From the manage hub. */}
      <Tabs.Screen name="schedule-merge" options={{ href: null }} />
      <Tabs.Screen name="schedule-overrides" options={{ href: null }} />
      {/* Assistant management (teacher-only) — reached from Settings, not a tab. */}
      <Tabs.Screen name="assistants" options={{ href: null }} />
      {/* Getting Started reference — pushed from Settings, not a tab. */}
      <Tabs.Screen name="getting-started" options={{ href: null }} />
    </Tabs>
    </>
  );
}
