import { useEffect, useRef } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/index';
import { registerForPushNotifications, unregisterPushNotifications } from '@/utils/push-notifications';
import { useNotificationTaps } from '@/hooks/useNotificationTaps';
import { type IconName } from '@/components/ui/Icon';
import { NotchTabBar } from '@/components/ui/NotchTabBar';
import { boundedSceneLayout } from '@/navigation/boundedScenes';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { ROUTE_BY_ROLE } from '@/utils/routes';

// Visible tabs stay mounted; detail screens (href: null) are released once they are not one
// of the two most recently visited — see src/navigation/boundedScenes.tsx. Only the visible
// tabs are frozen on blur: a frozen screen defers its own release.
const VISIBLE_TABS: ReadonlySet<string> = new Set(["index","children","teachers","invoices","profile"]);
const sceneLayout = boundedSceneLayout(VISIBLE_TABS);

// Five large, always-labelled tabs, أبنائي raised in the middle (founder 2026-10-03: «a cut
// design on the middle nav for the most important tab»). Teacher Management is its own tab
// per an explicit founder decision; the same management also stays inline in child detail.
// Reports and Tickets are stack screens (href: null below): Reports surfaces from child
// detail, support (Tickets) from the «المساعدة والدعم» action on Home — Tickets left the
// bar on 2026-10-03 so the bar has a middle.
const TAB_ORDER = ['index', 'teachers', 'children', 'invoices', 'profile'] as const;
const CENTER_TAB = 'children';
const labels: Record<string, string> = {
  index: 'nav.home',
  children: 'nav.children',
  teachers: 'parent.teachers',
  invoices: 'nav.invoices',
  profile: 'nav.settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  children: 'children',
  teachers: 'teacher',
  invoices: 'invoices',
  profile: 'settings',
};

// Inside an open ticket conversation ([id], the reply box) or the compose form (create),
// a floating bar overlaps the input + send button, so no bar is mounted there — the ticket
// LIST keeps it. The nested state is undefined until the stack mounts (= the list).
function shouldHideBar(state: { routes: { name: string; state?: unknown }[]; index: number }): boolean {
  const tab = state.routes[state.index];
  if (tab?.name !== 'tickets') return false;
  const nested = tab.state as { routes?: { name: string }[]; index?: number } | undefined;
  const nestedName = nested?.routes?.[nested?.index ?? 0]?.name;
  return nestedName === '[id]' || nestedName === 'create';
}

export default function ParentTabLayout() {
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

  // Freezing the hidden tabs (react-freeze) is a FLAG, off by default (2026-10-01). With 5+
  // tabs it is the documented cause of memory growing and the JS thread getting slower with
  // every tab switch (react-native-screens #2971) — the teacher-side complaint word for
  // word. Older detail screens are released by BoundedScene regardless. Super-admin flag
  // «تجميد التبويبات المخفية», read from /app-config at launch, so the two can be compared
  // on one phone without a rebuild.
  const freezeTabs = useFeatureFlags().data?.freeze_hidden_tabs === true;
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
    <Tabs
      // Hardware back follows visit history, so pushed detail screens (reports,
      // report-cards, child/[id], quiz/[quizId], …) pop back to the previous screen
      // instead of jumping to the Home tab.
      backBehavior="history"
      screenLayout={sceneLayout}
      // No bar inside an open ticket; every real tab shows the notched bar.
      tabBar={(props) => {
        if (shouldHideBar(props.state)) return null;
        return <NotchTabBar {...props} tabs={TAB_ORDER} center={CENTER_TAB} labels={labels} icons={icons} />;
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        freezeOnBlur: freezeTabs && VISIBLE_TABS.has(route.name),
        sceneStyle: { backgroundColor: colors.background },
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="children" />
      <Tabs.Screen name="teachers" />
      <Tabs.Screen name="invoices" />
      {/* Support tickets — from Home's «المساعدة والدعم» tile, not a tab (2026-10-03). */}
      <Tabs.Screen name="tickets" options={{ href: null }} />
      <Tabs.Screen name="profile" />
      {/* Demoted from the tab bar; still routable from Home / child detail. */}
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="report-cards" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="today" options={{ href: null }} />
      <Tabs.Screen name="child/[id]" options={{ href: null }} />
      <Tabs.Screen name="child/[id]/teachers" options={{ href: null }} />
      <Tabs.Screen name="child/[id]/invite-code" options={{ href: null }} />
      <Tabs.Screen name="quiz/[quizId]" options={{ href: null }} />
      {/* Self-service name + phone change — pushed from the profile, not tabs. */}
      <Tabs.Screen name="change-phone" options={{ href: null }} />
      <Tabs.Screen name="change-name" options={{ href: null }} />
      {/* The card-order form is a full-page flow with its own submit button — the
          floating tab bar sits on top of it, so it is hidden here (same as student). */}
      <Tabs.Screen name="order-card" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      {/* Support → the admin queue. Full-page compose, so the floating bar is hidden. */}
      <Tabs.Screen name="support" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}
