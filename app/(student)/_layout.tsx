import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet, AppState, type AppStateStatus } from 'react-native';
import { registerForPushNotifications } from '@/utils/push-notifications';
import { useNotificationTaps } from '@/hooks/useNotificationTaps';
import { useAuthStore } from '@/stores/authStore';
import { fonts } from '@/theme/typography';
import { colors, radius } from '@/theme/index';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/ui/Icon';

const icons: Record<string, IconName> = {
  index: 'home',
  'check-in': 'attendance',
  invoices: 'invoices',
  profile: 'profile',
};

export default function StudentTabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // The student's phone never registered for push, so grades, invoices, card status and
  // the parent-unreachable nudge only ever reached the in-app inbox. Same wiring as the
  // teacher layout; a tapped push then opens the screen it is about.
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotifications();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') registerForPushNotifications();
    });
    return () => sub.remove();
  }, [isAuthenticated]);
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

  return (
    <Tabs
      // Hardware back follows visit history, so pushed detail screens (marks, swap,
      // order-card, notifications) pop back to the previous screen instead of jumping
      // to the Home tab.
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        freezeOnBlur: true,
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
        tabBarLabel: ({ focused }) => (
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 11,
              color: focused ? colors.primary : colors.textTertiary,
              marginTop: 2,
            }}
          >
            {route.name === 'index' ? t('nav.dashboard') : route.name === 'check-in' ? t('nav.check_in') : route.name === 'invoices' ? t('nav.invoices') : t('nav.profile')}
          </Text>
        ),
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
      <Tabs.Screen name="check-in" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="marks" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="swap" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="order-card" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="notifications" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      {/* Support → the admin queue. Full-page compose, so the floating bar is hidden. */}
      <Tabs.Screen name="support" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
