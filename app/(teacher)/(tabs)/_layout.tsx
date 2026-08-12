import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineStore } from '@/stores/offlineStore';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * Teacher (and assistant) tab bar. Auth gate + offline bootstrap live one level up
 * in the (teacher) stack layout. Full-screen camera screens (enroll) are NOT here —
 * they're stack screens above this navigator, so they never render a tab bar.
 *
 * `scan` IS a visible tab (the Camera tab). It hides the bar while focused via the
 * custom `tabBar` below (react-navigation's own render hook — the bar component is
 * simply not rendered, not styled away).
 */
const labels: Record<string, string> = {
  index: 'teacher.tab_home',
  scan: 'teacher.tab_camera',
  students: 'teacher.tab_students',
  tickets: 'teacher.tab_tickets',
  settings: 'teacher.tab_settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  scan: 'scan',
  students: 'children',
  tickets: 'tickets',
  settings: 'settings',
};

export default function TeacherTabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pending = useOfflineStore((s) => s.pending);

  return (
    <Tabs
      // Camera tab is full-screen: render NO bar while 'scan' is focused.
      tabBar={(props) => {
        const focused = props.state.routes[props.state.index]?.name;
        if (focused === 'scan') return null;
        return <BottomTabBar {...props} />;
      }}
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
      <Tabs.Screen
        name="scan"
        options={{ tabBarBadge: pending > 0 ? pending : undefined }}
      />
      <Tabs.Screen name="students" />
      <Tabs.Screen name="tickets" />
      <Tabs.Screen name="settings" />
      {/* Reconciliation is reached from the pending badge / Home, not a tab. */}
      <Tabs.Screen name="reconcile" options={{ href: null }} />
      {/* Revision-session picker → scan tab in revision mode. Not a tab. */}
      <Tabs.Screen name="revisions" options={{ href: null }} />
      {/* Payment kind picker → scan tab in payment mode. Not a tab. */}
      <Tabs.Screen name="collect" options={{ href: null }} />
      {/* Grant a billing exception — searched from Home, not a tab. */}
      <Tabs.Screen name="grant-exception" options={{ href: null }} />
    </Tabs>
  );
}
