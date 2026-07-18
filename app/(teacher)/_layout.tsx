import { Redirect, Tabs } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * Teacher (and assistant) app — a dedicated 4-tab bar, deliberately separate
 * from the parent/student navigation. Assistant access is reduced by role checks
 * inside the tabs (Overrides section on Home), never by a different layout.
 */
const labels: Record<string, string> = {
  index: 'teacher.tab_home',
  scan: 'teacher.tab_camera',
  tickets: 'teacher.tab_tickets',
  settings: 'teacher.tab_settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  scan: 'scan',
  tickets: 'tickets',
  settings: 'settings',
};

export default function TeacherTabLayout() {
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
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="tickets" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
