import type { ComponentProps } from 'react';
import { useMemo, useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View, Text, ActivityIndicator, AppState, type AppStateStatus, StyleSheet } from 'react-native';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, stampTeacherId } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { initOfflineScans } from '@/db/offlineScans';
import { initOfflineMarks } from '@/db/offlineMarks';
import { prefetchTodayRosters } from '@/db/prefetchRosters';
import { triggerAutoSync } from '@/db/autoSync';
import { syncScheduleCacheOnOpen } from '@/db/scheduleCache';
import { registerForPushNotifications } from '@/utils/push-notifications';
import { useNotificationTaps } from '@/hooks/useNotificationTaps';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { RelocationPrompt } from '@/components/teacher/RelocationPrompt';
import { fonts } from '@/theme/typography';
import { colors, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { boundedSceneLayout } from '@/navigation/boundedScenes';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// Visible tabs stay mounted; detail screens (href: null) are released once they are not one
// of the two most recently visited — see src/navigation/boundedScenes.tsx. Only the visible
// tabs are frozen on blur: a frozen screen defers its own release.
const VISIBLE_TABS: ReadonlySet<string> = new Set(["index","sessions","manage","students","settings"]);
const sceneLayout = boundedSceneLayout(VISIBLE_TABS);

/**
 * Teacher (and assistant) app — a 5-tab bar (home · sessions · students · manage ·
 * settings), deliberately separate from the parent/student navigation. Tickets left the
 * bar on 2026-10-02 (reached from Home's attention list and Management → المتابعة); the
 * attendance sheet moved out from under Students into its own الحصص tab.
 *
 * The invite-student camera screen (`enroll`) is a full-screen route: it's reached
 * by push (never a tab button) and hides the bar via the custom `tabBar` below —
 * react-navigation's own render hook returns NOTHING for that route, so the bar
 * component is simply not mounted there (not a style override). Every actual tab —
 * scan/Camera included — renders the normal bar.
 */
const labels: Record<string, string> = {
  index: 'teacher.tab_home',
  sessions: 'teacher.tab_sessions',
  students: 'teacher.tab_students',
  manage: 'teacher.tab_manage',
  settings: 'teacher.tab_settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  sessions: 'sessions',
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
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const role = useAuthStore((s) => s.role);

  // Ensure the offline buffer table exists, seed the pending count, and refresh
  // it whenever the app returns to the foreground (a chance to reconcile).
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    Promise.all([initOfflineScans(), initOfflineMarks()]).then(() => {
      if (active) useOfflineStore.getState().refresh();
    });
    // Part 2: on open, enforce the date staleness guard and refresh the ACTIVE
    // teacher's schedule entry when online. Fire-and-forget — never blocks the UI,
    // and a failure just leaves the guard to fall back to manual reconciliation.
    // Today's rosters are pre-fetched after the schedule so the attendance sheet opens
    // offline for sessions the teacher never opened while connected.
    syncScheduleCacheOnOpen(useOfflineStore.getState().online, stampTeacherId(useAuthStore.getState()))
      .finally(() => { void triggerAutoSync(); void prefetchTodayRosters(); });
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') {
        useOfflineStore.getState().refresh();
        // Refresh the cache first so auto-sync runs against fresh windows.
        syncScheduleCacheOnOpen(useOfflineStore.getState().online, stampTeacherId(useAuthStore.getState()))
          .finally(() => { void triggerAutoSync(); void prefetchTodayRosters(); });
      }
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [isAuthenticated]);

  // A tapped push opens the screen it is about (running or launched by the tap); an
  // assistant is never sent where the server would refuse them.
  const { can } = useActiveAbilities();
  useNotificationTaps(can);

  // Register this device's push token so teacher notifications (daily financial
  // report, admin-ticket replies, etc.) can be delivered via FCM. Previously this
  // was wired only in the parent layout, so teachers had no tokens. Fire-and-forget;
  // a permission denial or iOS APNs limitation just yields no token (in-app inbox
  // still works). Re-run on foreground so a later permission grant is picked up.
  // Never while impersonating: the phone is the super-admin's, and registering it would
  // hand the teacher's pushes to the admin (the server refuses it too).
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  useEffect(() => {
    if (!isAuthenticated || impersonating) return;
    registerForPushNotifications();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') registerForPushNotifications();
    });
    return () => sub.remove();
  }, [isAuthenticated, impersonating]);

  // Connectivity: drive the offline/online indicator AND kick a window-bounded
  // auto-sync pass when connectivity is restored (the unambiguous scans upload
  // themselves; everything else stays for manual reconcile). triggerAutoSync is
  // rate-limited + single-flight, so a flapping connection never hammers the endpoint.
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      const wasOnline = useOfflineStore.getState().online;
      useOfflineStore.getState().setOnline(online);
      if (online && !wasOnline) void triggerAutoSync();
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

  // screenOptions is MEMOISED and its label/icon are module-level components.
  //
  // It used to be an inline arrow returning a fresh object — with fresh `tabBarLabel` and
  // `tabBarIcon` closures — for EVERY ONE of the 36 registered screens. This layout
  // re-renders whenever the offline badge changes (pending/rejected scans), so a single
  // sync tick rebuilt 36 option objects and re-rendered the whole tab bar. On an
  // entry-level device that is a visible stutter on a screen the teacher never left.
  // Only `insets` and `t` actually affect the result, so that is all it depends on.
  // Freezing the hidden tabs (react-freeze) is a FLAG, off by default (2026-10-01). With 5+
  // tabs it is the documented cause of memory growing and the JS thread getting slower with
  // every tab switch (react-native-screens #2971) — the teacher-side complaint word for
  // word. Older detail screens are released by BoundedScene regardless. Super-admin flag
  // «تجميد التبويبات المخفية», read from /app-config at launch, so the two can be compared
  // on one phone without a rebuild.
  const freezeTabs = useFeatureFlags().data?.freeze_hidden_tabs === true;
  const screenOptions = useMemo<ComponentProps<typeof Tabs>['screenOptions']>(
    () => ({ route }) => ({
        headerShown: false,
        freezeOnBlur: freezeTabs && VISIBLE_TABS.has(route.name),
        // Consistent scene background so a tab switch never flashes a white frame
        // between two screens (e.g. the black scanner and a cream screen).
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          // OPAQUE on purpose. A translucent bar (this was rgba(...,0.92)) is a floating,
          // absolutely-positioned overlay, so every frame Android had to re-composite the
          // scene BEHIND it — on every screen, in every role. Together with elevation 8 and
          // two rounded corners that is continuous GPU work and a measurable heat source on
          // mid-range chips (Redmi Note 11S / Helio G96, 2026-09-22). Opaque + a hairline
          // rule keeps the same lifted look for free.
          backgroundColor: '#FFFFFF',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 10 + insets.bottom,
          height: 64 + insets.bottom,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
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
    }),
    [insets.bottom, t, freezeTabs],
  );

  return (
    <>
    {/* Relocation prompt — teachers only (assistants never edit geofence anchors). */}
    {isAuthenticated && role === 'teacher' ? <RelocationPrompt enabled /> : null}
    <Tabs
      // Hardware back follows the actual visit history, not the default "jump to the
      // first tab" — so pushed detail screens (courses, insights, pending-collections,
      // …, all registered here as href:null tab routes) pop back to where you came from
      // instead of teleporting Home.
      backBehavior="history"
      // Render NO bar on full-screen surfaces (invite scanner, open ticket) by not
      // mounting the bar component for them. Every real tab shows the bar.
      tabBar={(props) => {
        if (shouldHideBar(props.state)) return null;
        return <BottomTabBar {...props} />;
      }}
      screenOptions={screenOptions}
      screenLayout={sceneLayout}
    >
      <Tabs.Screen name="index" />
      {/* The scanner is no longer a tab: it opens from the QR button beside the bell on
          Home (and from each session card). Its pending-scans badge moved there too. */}
      <Tabs.Screen
        name="scan"
        // NOT frozen: the camera unmounts through a re-render on blur, and a frozen screen
        // skips exactly that render — the sensor would keep running behind another tab.
        options={{ href: null, freezeOnBlur: false }}
      />
      {/* الحصص — today + history + the attendance sheet (manual marks work offline). */}
      <Tabs.Screen name="sessions" />
      {/* Management hub — third, next to the day (founder 2026-10-02). Four groups:
          students · schedule · money · follow-up. */}
      <Tabs.Screen name="manage" />
      <Tabs.Screen name="students" />
      <Tabs.Screen name="settings" />
      {/* Parent tickets — from Home's attention list and Management → المتابعة, not a tab. */}
      <Tabs.Screen name="tickets" options={{ href: null }} />
      {/* الاستثناءات — billing exceptions + phone check-in permissions, from Management. */}
      <Tabs.Screen name="overrides" options={{ href: null }} />
      {/* Reconciliation is reached from the pending badge / Home, not a tab. */}
      <Tabs.Screen name="resolution" options={{ href: null }} />
      {/* «أرقام تحتاج تأكيد» — pushed from the Home card and the Resolution Center. */}
      <Tabs.Screen name="phone-confirmations" options={{ href: null }} />
      {/* Insights — pushed from the manage hub, not a tab. */}
      <Tabs.Screen name="insights" options={{ href: null }} />
      {/* Order a card for an existing enrollment — pushed from the roster cards segment. */}
      <Tabs.Screen name="card-order-new" options={{ href: null }} />
      {/* Mint a card-order portal link for a not-yet-enrolled family — from the manage hub. */}
      <Tabs.Screen name="card-order-link" options={{ href: null }} />
      {/* أماكن التدريس — the teacher's own venues, from the manage hub. */}
      <Tabs.Screen name="venues" options={{ href: null }} />
      <Tabs.Screen name="reconcile" options={{ href: null }} />
      {/* Enroll-by-card (invite student) — pushed from Home; full screen, no bar. */}
      <Tabs.Screen name="enroll" options={{ href: null, freezeOnBlur: false }} />{/* camera screen — see scan */}
      {/* Fast student recording (name + parent phone) — pushed from Home, not a tab. */}
      <Tabs.Screen name="record-student" options={{ href: null }} />
      <Tabs.Screen name="revision-create" options={{ href: null }} />
      {/* One-off special/exam session creator (normal mode) — pushed from Manage. */}
      <Tabs.Screen name="exam-create" options={{ href: null }} />
      <Tabs.Screen name="invite-link" options={{ href: null }} />
      <Tabs.Screen name="booking-requests" options={{ href: null }} />
      <Tabs.Screen name="assistant-actions" options={{ href: null }} />
      {/* مدام روز — مديرة الحسابات: opened from the payments card on Home and from the
          manage hub, not a tab. */}
      <Tabs.Screen name="cash-reconcile" options={{ href: null }} />
      <Tabs.Screen name="expenses" options={{ href: null }} />
      {/* Weekly review (the teacher reconciles) + the question thread on one expense. */}
      <Tabs.Screen name="cash-review" options={{ href: null }} />
      <Tabs.Screen name="expense-thread" options={{ href: null }} />
      {/* Revision-session picker → scan tab in revision mode. Not a tab. */}
      <Tabs.Screen name="revisions" options={{ href: null }} />
      {/* Merged-exam mark entry — pushed from the revisions list, not a tab. */}
      <Tabs.Screen name="revision-marks" options={{ href: null }} />
      {/* Payment kind picker → scan tab in payment mode. Not a tab. */}
      <Tabs.Screen name="collect" options={{ href: null }} />
      <Tabs.Screen name="pending-collections" options={{ href: null }} />
      {/* Billing settings (teacher-only) + payment-proof review — from the manage hub. */}
      <Tabs.Screen name="billing-settings" options={{ href: null }} />
      <Tabs.Screen name="payment-proofs" options={{ href: null }} />
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
