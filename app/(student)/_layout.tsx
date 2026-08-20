import { Redirect, Tabs } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/index';
import { type IconName } from '@/components/ui/Icon';
import { RaisedTabBar } from '@/components/layout/RaisedTabBar';

const icons: Record<string, IconName> = {
  index: 'home',
  sessions: 'calendar',
  'check-in': 'scan',
  invoices: 'invoices',
  profile: 'profile',
};

export default function StudentTabLayout() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

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

  const labels: Record<string, string> = {
    index: t('nav.dashboard'),
    sessions: t('session.my_sessions'),
    'check-in': t('nav.check_in'),
    invoices: t('nav.invoices'),
    profile: t('nav.profile'),
  };

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <RaisedTabBar
          {...props}
          tabs={['index', 'sessions', 'invoices', 'profile']}
          icons={icons}
          labels={labels}
          center={{ name: 'check-in', icon: 'scan' }}
        />
      )}
    >
      {/* Strip: index · sessions | [check-in FAB] | invoices · profile.
          notifications/swap/order-card are pushed (bell / flows), not tabs. */}
      <Tabs.Screen name="index" />
      <Tabs.Screen name="sessions" />
      <Tabs.Screen name="check-in" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="swap" options={{ href: null }} />
      <Tabs.Screen name="order-card" options={{ href: null }} />
    </Tabs>
  );
}
