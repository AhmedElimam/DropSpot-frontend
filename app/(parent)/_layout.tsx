import { useEffect, useRef } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View, Text, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows } from '@/theme/index';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerForPushNotifications, unregisterPushNotifications } from '@/utils/push-notifications';
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
  profile: 'nav.settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  children: 'children',
  teachers: 'teacher',
  invoices: 'invoices',
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
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="children" />
      <Tabs.Screen name="teachers" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="profile" />
      {/* Demoted from the tab bar; still routable from Home / child detail. */}
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="tickets" options={{ href: null }} />
      <Tabs.Screen name="child/[id]" options={{ href: null }} />
      <Tabs.Screen name="child/[id]/teachers" options={{ href: null }} />
      <Tabs.Screen name="quiz/[quizId]" options={{ href: null }} />
    </Tabs>
  );
}
