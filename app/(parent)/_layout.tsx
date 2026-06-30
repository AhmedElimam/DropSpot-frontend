import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows } from '@/theme/index';
import { useTranslation } from 'react-i18next';

const icons: Record<string, string> = {
  index: '🔔',
  children: '👨‍👩‍👧‍👦',
  invoices: '💳',
  support: '🎫',
  profile: '⚙️',
};

export default function ParentTabLayout() {
  const { t } = useTranslation();

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
            {route.name === 'index' ? t('nav.home') : route.name === 'children' ? t('nav.children') : route.name === 'invoices' ? t('nav.invoices') : route.name === 'support' ? t('nav.support') : t('nav.settings')}
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
      <Tabs.Screen name="children" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="support" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
