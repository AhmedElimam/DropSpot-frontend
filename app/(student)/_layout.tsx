import { Redirect, Tabs } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows } from '@/theme/index';
import { useTranslation } from 'react-i18next';

const icons: Record<string, string> = {
  index: '🏠',
  'check-in': '📌',
  quiz: '📝',
  profile: '👤',
};

export default function StudentTabLayout() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  console.log('[StudentLayout] Mounted, isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'role:', useAuthStore.getState().role);

  if (isLoading) {
    console.log('[StudentLayout] Loading state');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    console.log('[StudentLayout] Not authenticated, redirecting to login');
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
          paddingBottom: 10,
          height: 64,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          ...shadows.glow,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
        },
        tabBarLabel: ({ focused }) => (
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 10,
              color: focused ? colors.primary : colors.textTertiary,
              marginTop: 2,
            }}
          >
            {route.name === 'index' ? t('nav.dashboard') : route.name === 'check-in' ? t('nav.check_in') : route.name === 'quiz' ? t('nav.quiz') : t('nav.profile')}
          </Text>
        ),
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
      <Tabs.Screen name="check-in" />
      <Tabs.Screen name="quiz" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
