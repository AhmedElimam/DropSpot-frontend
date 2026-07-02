import { Redirect, Tabs } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows } from '@/theme/index';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const labels: Record<string, string> = {
  index: 'nav.home',
  children: 'nav.children',
  tickets: 'nav.tickets',
  invoices: 'nav.invoices',
  reports: 'nav.reports',
  profile: 'nav.settings',
};

const icons: Record<string, string> = {
  index: '🔔',
  children: '👨‍👩‍👧‍👦',
  tickets: '🎫',
  invoices: '💳',
  reports: '📊',
  profile: '⚙️',
};

export default function ParentTabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
                fontSize: 10,
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
              opacity: focused ? 1 : 0.45,
              transform: [{ scale: focused ? 1.1 : 1 }],
            }}
          >
            <Text style={{ fontSize: 22 }}>
              {icons[route.name] || '📄'}
            </Text>
          </View>
        ),
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="children" />
      <Tabs.Screen name="tickets" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="child/[id]" options={{ href: null }} />
      <Tabs.Screen name="child/[id]/teachers" options={{ href: null }} />
    </Tabs>
  );
}