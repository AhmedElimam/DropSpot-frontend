import { useEffect, useRef } from 'react';
import { Redirect, Tabs, router } from 'expo-router';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { View, Text, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows } from '@/theme/index';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerForPushNotifications, unregisterPushNotifications, setupNotificationResponseHandler } from '@/utils/push-notifications';
import { notificationRoute } from '@/utils/notification-routing';
import { Icon, type IconName } from '@/components/ui/Icon';

// Five large, always-labelled tabs. Teacher Management was added as its own tab
// per an explicit founder decision (reversing the earlier 4-tab minimum); the
// same management also stays inline in child detail as a shortcut. Reports and
// Tickets remain demoted to stack screens (href: null below): Reports surfaces
// from child detail, support (Tickets) from the "المساعدة والدعم" action on Home.
const labels: Record<string, string> = {
  index: 'nav.home',
  children: 'nav.children',
  teachers: 'parent.teachers',
  invoices: 'nav.invoices',
  tickets: 'nav.tickets',
  profile: 'nav.settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  children: 'children',
  teachers: 'teacher',
  invoices: 'invoices',
  tickets: 'tickets',
  profile: 'settings',
};

export default function ParentTabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const pushTokenRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated) return;

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
      }
    };
  }, [isAuthenticated]);

  // Deep-link a tapped notification to the right screen (report cards, invoices,
  // the child, or the notifications feed) — the response handler existed but was
  // never registered, so taps went nowhere.
  useEffect(() => {
    const sub = setupNotificationResponseHandler((data) => {
      const route = notificationRoute(String(data?.type ?? ''), data);
      if (route) router.push(route as never);
    });
    return () => sub.remove();
  }, []);

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
      screenOptions={({ route }) => {
        // Inside an open ticket conversation ([id], the reply box) or the compose
        // form (create), the floating absolute tab bar overlaps the input + send
        // button, so hide it there — the ticket LIST keeps the bar. Focused nested
        // route is undefined until the stack mounts, which defaults to the list.
        const focusedName = getFocusedRouteNameFromRoute(route);
        const hideBar = route.name === 'tickets' && (focusedName === '[id]' || focusedName === 'create');

        return {
        headerShown: false,
        tabBarStyle: hideBar
          ? { display: 'none' }
          : {
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
          <View
            style={{
              opacity: focused ? 1 : 0.55,
              transform: [{ scale: focused ? 1.08 : 1 }],
            }}
          >
            <Icon
              name={icons[route.name] || 'home'}
              size={24}
              color={focused ? colors.primary : colors.textTertiary}
              outline={!focused}
            />
          </View>
        ),
        };
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="children" />
      <Tabs.Screen name="teachers" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="tickets" />
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
      {/* Self-service phone change — pushed from the profile, not a tab. */}
      <Tabs.Screen name="change-phone" options={{ href: null }} />
      <Tabs.Screen name="order-card" options={{ href: null }} />
    </Tabs>
  );
}
