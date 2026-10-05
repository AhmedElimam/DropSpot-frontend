import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, radius } from '@/theme/index';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/ui/Icon';
import { boundedSceneLayout } from '@/navigation/boundedScenes';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { useThreadsEnabled, useThreadsUnread } from '@/hooks/useThreads';

// The four tabs (the student bar is the stock one — founder 2026-10-03: leave it alone),
// plus «المحادثات» while course chat or threads is switched on.
// Every other student screen lives in the stack around this navigator
// (app/(student)/_layout.tsx), so it has the iOS edge swipe back (founder 2026-10-04).
const VISIBLE_TABS: ReadonlySet<string> = new Set(["index","check-in","chat","invoices","profile"]);
const sceneLayout = boundedSceneLayout(VISIBLE_TABS);

const icons: Record<string, IconName> = {
  index: 'home',
  'check-in': 'attendance',
  chat: 'chat',
  invoices: 'invoices',
  profile: 'profile',
};

export default function StudentTabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Freezing the hidden tabs is a super-admin FLAG, off by default (react-native-screens #2971).
  const freezeTabs = useFeatureFlags().data?.freeze_hidden_tabs === true;
  // Conversations — course chat rooms and/or the teacher's question threads, as segments of
  // ONE tab. Inert while both are off (the hooks make no request) and the tab is absent.
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  const { data: chatChannels } = useChatChannels(chatEnabled);
  const { data: threadsUnread } = useThreadsUnread(threadsEnabled);
  const chatUnread = (chatChannels ?? []).reduce((n, c) => n + (c.unread || 0), 0) + (threadsUnread ?? 0);
  // Named after whichever is on (both → «المحادثات»).
  const conversationsLabel = chatEnabled && threadsEnabled ? 'chat.conversations' : threadsEnabled ? 'threads.tab' : 'nav.chat';
  return (
    <Tabs
      // Hardware back follows visit history, so pushed detail screens (marks, swap,
      // order-card, notifications) pop back to the previous screen instead of jumping
      // to the Home tab.
      backBehavior="history"
      screenLayout={sceneLayout}
      screenOptions={({ route }) => ({
        headerShown: false,
        freezeOnBlur: freezeTabs && VISIBLE_TABS.has(route.name),
        tabBarStyle: {
          // OPAQUE on purpose. A translucent bar (this was rgba(...,0.92)) is a floating,
          // absolutely-positioned overlay, so every frame Android had to re-composite the
          // scene BEHIND it — on every screen, in every role. Together with elevation 8 and
          // two rounded corners that is continuous GPU work and a measurable heat source on
          // mid-range chips (Redmi Note 11S / Helio G96, 2026-09-22). Opaque + a hairline
          // rule keeps the same lifted look for free.
          backgroundColor: colors.tabBar,
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
              color: focused ? colors.tabActive : colors.tabInactive,
              marginTop: 2,
            }}
          >
            {route.name === 'index' ? t('nav.dashboard') : route.name === 'check-in' ? t('nav.check_in') : route.name === 'chat' ? t(conversationsLabel) : route.name === 'invoices' ? t('nav.invoices') : t('nav.profile')}
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
              name={route.name === 'chat' && !chatEnabled && threadsEnabled ? 'threads' : (icons[route.name] || 'home')}
              size={24}
              color={focused ? colors.tabActive : colors.tabInactive}
              outline={!focused}
            />
          </View>
        ),
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="check-in" />
      <Tabs.Screen
        name="chat"
        options={{
          href: chatEnabled || threadsEnabled ? undefined : null,
          tabBarBadge: chatUnread > 0 ? (chatUnread > 99 ? '99+' : chatUnread) : undefined,
        }}
      />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
