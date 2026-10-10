import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator, AppState, Platform, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore, stampTeacherId } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { initOfflineScans } from '@/db/offlineScans';
import { initOfflineMarks } from '@/db/offlineMarks';
import { prefetchTodayRosters } from '@/db/prefetchRosters';
import { scheduleWarmUp } from '@/db/warmUp';
import { pruneSessionDetailCache } from '@/db/sessionDetailCache';
import { initOutbox } from '@/db/outbox';
import { triggerAutoSync } from '@/db/autoSync';
import { syncScheduleCacheOnOpen } from '@/db/scheduleCache';
import { registerForPushNotifications } from '@/utils/push-notifications';
import { useNotificationTaps } from '@/hooks/useNotificationTaps';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { RelocationPrompt } from '@/components/teacher/RelocationPrompt';
import { colors } from '@/theme/index';
import { ROUTE_BY_ROLE } from '@/utils/routes';

// A deep link straight to a detail screen still has the tabs underneath to go back to.
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Teacher (and assistant) app: a STACK whose first screen is the tab bar ((tabs)/_layout).
 * Every other screen — a session's sheet, a student, collect, the scanner, مدام روز… — is
 * pushed on top of the tabs, so each one has the iOS edge swipe back and returns to where
 * it was opened from (founder 2026-10-04). They used to be hidden tabs (href: null), which
 * have no back gesture; opening a session from Home also switched tabs on the way.
 * Full-screen camera screens (scan, enroll) simply have no bar now — they are not tabs.
 */

/** How often a return to the app may re-download today's schedule and the roster. */
const SCHEDULE_REFRESH_MS = 10 * 60_000;

export default function TeacherLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const role = useAuthStore((s) => s.role);

  // Ensure the offline buffer table exists, seed the pending count, and refresh
  // it whenever the app returns to the foreground (a chance to reconcile).
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    Promise.all([initOfflineScans(), initOfflineMarks(), initOutbox(), pruneSessionDetailCache()]).then(() => {
      if (active) useOfflineStore.getState().refresh();
    });
    // Part 2: on open, enforce the date staleness guard and refresh the ACTIVE
    // teacher's schedule entry when online. Fire-and-forget — never blocks the UI,
    // and a failure just leaves the guard to fall back to manual reconciliation.
    // Today's rosters are pre-fetched after the schedule so the attendance sheet opens
    // offline for sessions the teacher never opened while connected.
    syncScheduleCacheOnOpen(useOfflineStore.getState().online, stampTeacherId(useAuthStore.getState()))
      .finally(() => { void triggerAutoSync(); void prefetchTodayRosters(); scheduleWarmUp(5000); });
    let lastRefresh = { at: Date.now(), day: new Date().toDateString() };
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') {
        useOfflineStore.getState().refresh();
        // Every return still prunes stale days (local) and sends the buffered door scans. The
        // network refresh — today's sessions AND the whole roster — runs at most every 10 min
        // or when the day has changed: a teacher switching apps 20 times an hour paid for 60
        // requests (founder 2026-10-09: «light on all devices»).
        const today = new Date().toDateString();
        const due = Date.now() - lastRefresh.at > SCHEDULE_REFRESH_MS || lastRefresh.day !== today;
        if (due) lastRefresh = { at: Date.now(), day: today };
        // Refresh the cache first so auto-sync runs against fresh windows.
        syncScheduleCacheOnOpen(due && useOfflineStore.getState().online, stampTeacherId(useAuthStore.getState()))
          .finally(() => { void triggerAutoSync(); if (due) { void prefetchTodayRosters(); scheduleWarmUp(2000); } });
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
      useOfflineStore.getState().setOnline(online, state.type === 'wifi' ? 'wifi' : state.type === 'cellular' ? 'cellular' : 'other');
      if (online && !wasOnline) void triggerAutoSync();
    });
    // A weak link that answers again is the same moment: send what was parked meanwhile.
    const unsubWeak = useOfflineStore.subscribe((s, prev) => {
      if (prev.weak && !s.weak && s.pending > 0) void triggerAutoSync();
    });
    return () => { unsub(); unsubWeak(); };
  }, [isAuthenticated]);

  // Every hook above runs on EVERY render — the early returns live here, after them (an
  // early return above a hook threw «Rendered fewer hooks than expected» on sign-out).
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

  // Not this role's app (a super-admin whose impersonation just ended, a role that changed
  // under the screen): `/` routes by role. Without this the teacher tabs kept rendering for
  // the admin until something else navigated.
  if (role && role !== 'teacher' && role !== 'assistant') {
    if (__DEV__) console.log('[route] (teacher) → resolve for role', role);
    return <Redirect href={ROUTE_BY_ROLE} />;
  }

  return (
    <>
    {/* Relocation prompt — teachers only (assistants never edit geofence anchors). */}
    {isAuthenticated && role === 'teacher' ? <RelocationPrompt enabled /> : null}
    // freezeOnBlur off for THIS stack (founder 2026-10-08: «a stutter in the middle of the back
    // gesture»). enableFreeze(true) in app/_layout made every native-stack screen freeze when
    // covered, so the tabs under a pushed screen sat frozen and the swipe back thawed them
    // mid-gesture — React flushed the whole covered screen's pending renders inside the
    // transition. The screen underneath now stays live (one or two screens deep, not the 30
    // hidden tabs the freeze was for — those keep their own `freeze_hidden_tabs` switch).
    <Stack screenOptions={{ headerShown: false, freezeOnBlur: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      {/* Search keeps the NATIVE push: a custom animation (the fade tried first) loses iOS's
          finger-tracking swipe back, which then stuttered (founder 2026-10-10). The stutter on
          the way in was the keyboard rising mid-push; app/(teacher)/search.tsx raises it only
          after the push ends and drops it the moment a swipe back begins. */}
      <Stack.Screen name="search" />
      {/* A «شروحات» video plays full screen over whatever opened it. Transparent, because the
          player paints its own black and fades it as you swipe it down — the screen behind shows
          through, like closing a TikTok video (founder 2026-10-09). */}
      <Stack.Screen name="tutorial/[key]" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' }, gestureEnabled: false }} />
      {/* A student opened from a list: a native page sheet over it (iOS), a slide-up on Android.
          Not a form sheet with detents: its pan swallowed the profile's scrolling and left a
          gap under the sheet (founder 2026-10-06). The page sheet reaches the bottom edge,
          scrolls normally, and closes with the system swipe once the content is at its top. */}
      <Stack.Screen
        name="student-sheet/[id]"
        options={Platform.OS === 'ios'
          ? { presentation: 'modal', contentStyle: { backgroundColor: colors.background } }
          // Android has no native page sheet: a transparent screen that draws its own, below
          // the status bar, with a drag to close (founder 2026-10-07: under the notch, no swipe).
          : { presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
      />
    </Stack>
    </>
  );
}
