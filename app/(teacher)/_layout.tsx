import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View, ActivityIndicator, AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { useAuthStore, stampTeacherId } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { initOfflineScans } from '@/db/offlineScans';
import { syncScheduleCacheOnOpen } from '@/db/scheduleCache';
import { registerForPushNotifications } from '@/utils/push-notifications';
import { RelocationPrompt } from '@/components/teacher/RelocationPrompt';
import { colors } from '@/theme/index';
import { RaisedTabBar } from '@/components/layout/RaisedTabBar';
import { type IconName } from '@/components/ui/Icon';

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
const icons: Record<string, IconName> = {
  index: 'home',
  scan: 'scan',
  students: 'children',
  manage: 'book',
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
      // Strip: index · students | [scan FAB] | manage · settings. The center FAB
      // is the attendance scanner; on the scanner (and the invite scanner / an open
      // ticket) the bar is force-hidden because a custom tabBar can't read each
      // screen's tabBarStyle. Every pushed href:null flow hides itself in RaisedTabBar.
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => (
        <RaisedTabBar
          {...props}
          tabs={['index', 'students', 'manage', 'settings']}
          icons={icons}
          labels={{
            index: t('teacher.tab_home'),
            students: t('teacher.tab_students'),
            manage: t('teacher.tab_courses'),
            settings: t('teacher.tab_more'),
            scan: t('teacher.tab_camera'),
          }}
          center={{ name: 'scan', icon: 'scan' }}
          hidden={shouldHideBar(props.state)}
          centerBadge={needsAttention}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="students" />
      {/* Management hub — courses, location, schedule tools. */}
      <Tabs.Screen name="manage" />
      <Tabs.Screen name="settings" />
      {/* Admin-ticket channel — opened from the "المزيد" (settings) hub, not a tab. */}
      <Tabs.Screen name="tickets" options={{ href: null }} />
      {/* Reconciliation is reached from the pending badge / Home, not a tab. */}
      <Tabs.Screen name="resolution" options={{ href: null }} />
      {/* Insights — pushed from the manage hub, not a tab. */}
      <Tabs.Screen name="insights" options={{ href: null }} />
      {/* Order a card for an existing enrollment — pushed from the roster cards segment. */}
      <Tabs.Screen name="card-order-new" options={{ href: null }} />
      <Tabs.Screen name="reconcile" options={{ href: null }} />
      {/* Enroll-by-card (invite student) — pushed from Home; full screen, no bar. */}
      <Tabs.Screen name="enroll" options={{ href: null }} />
      <Tabs.Screen name="revision-create" options={{ href: null }} />
      <Tabs.Screen name="invite-link" options={{ href: null }} />
      {/* Revision-session picker → scan tab in revision mode. Not a tab. */}
      <Tabs.Screen name="revisions" options={{ href: null }} />
      {/* Merged-exam mark entry — pushed from the revisions list, not a tab. */}
      <Tabs.Screen name="revision-marks" options={{ href: null }} />
      {/* Payment kind picker → scan tab in payment mode. Not a tab. */}
      <Tabs.Screen name="collect" options={{ href: null }} />
      <Tabs.Screen name="pending-collections" options={{ href: null }} />
      {/* Notifications feed — opened from the home-header bell, not a tab. */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="invite-phone" options={{ href: null }} />
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
