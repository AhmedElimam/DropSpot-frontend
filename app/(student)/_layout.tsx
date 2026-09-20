import { useEffect, useRef } from 'react';
import { Redirect, Tabs, router, type Href } from 'expo-router';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { View, Text, ActivityIndicator, AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { registerForPushNotifications, unregisterPushNotifications, setupNotificationResponseHandler } from '@/utils/push-notifications';
import { useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { useThreadsEnabled, useThreadsUnread } from '@/hooks/useThreads';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows } from '@/theme/index';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/ui/Icon';

const icons: Record<string, IconName> = {
  index: 'home',
  'check-in': 'attendance',
  chat: 'chat',
  invoices: 'invoices',
  profile: 'profile',
};

const labels: Record<string, string> = {
  index: 'nav.dashboard',
  'check-in': 'nav.check_in',
  chat: 'nav.chat',
  invoices: 'nav.invoices',
  profile: 'nav.profile',
};

/** Where a tapped push lands a student. Chat goes to the room; everything else to the feed. */
function studentNotificationRoute(type: string, data: Record<string, unknown>): Href | null {
  if (type === 'chat_message' || type === 'chat_muted' || type === 'chat_unmuted' || type === 'chat_warning') {
    const courseId = data?.course_id;
    return courseId != null ? (`/(student)/chat/${courseId}` as Href) : ('/(student)/chat' as Href);
  }
  // Threads: a new question, the teacher's answer, a pick, a removed comment — all land on the thread.
  if (type.startsWith('thread_')) {
    const threadId = data?.thread_id;
    return threadId ? (`/(student)/chat/thread/${threadId}` as Href) : ('/(student)/chat' as Href);
  }
  return '/(student)/notifications' as Href;
}

export default function StudentTabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const pushTokenRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // The tab and its badge only exist while the feature is on; the hook makes no request
  // otherwise. Shares a query key with Home, so this is not a second poll.
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  const { data: chatChannels } = useChatChannels(chatEnabled);
  const { data: threadsUnread } = useThreadsUnread(threadsEnabled);
  const chatUnread = (chatChannels ?? []).reduce((n, c) => n + (c.unread || 0), 0) + (threadsUnread ?? 0);
  // The one tab hosts both surfaces; it is named after whichever is on (both → «المحادثات»).
  const conversationsLabel = chatEnabled && threadsEnabled ? 'chat.conversations' : threadsEnabled ? 'threads.tab' : 'nav.chat';

  // Push registration. The student side never registered a device token before, so
  // no push ever reached a student — chat is push-only (never SMS), so this is the
  // moment it had to start. Same pattern as the parent layout: on sign-in and on
  // every return to the foreground (the token can rotate while backgrounded).
  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotifications().then((token) => { pushTokenRef.current = token; });

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        registerForPushNotifications().then((token) => { pushTokenRef.current = token; });
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
      if (pushTokenRef.current) unregisterPushNotifications(pushTokenRef.current);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const sub = setupNotificationResponseHandler((data) => {
      const route = studentNotificationRoute(String(data?.type ?? ''), data);
      if (route) router.push(route);
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
      // Hardware back follows visit history, so pushed detail screens (marks, swap,
      // order-card, notifications) pop back to the previous screen instead of jumping
      // to the Home tab.
      backBehavior="history"
      screenOptions={({ route }) => {
        // Inside a chat room the floating bar would sit on the compose box; the rooms
        // LIST keeps it. The focused nested name is undefined until the stack mounts,
        // which defaults to the list.
        const focusedName = getFocusedRouteNameFromRoute(route);
        const hideBar = route.name === 'chat' && (focusedName === '[courseId]' || focusedName === 'thread/[id]');

        return {
        headerShown: false,
        tabBarStyle: hideBar ? { display: 'none' } : {
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
        tabBarLabel: ({ focused }) => (
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 11,
              color: focused ? colors.primary : colors.textTertiary,
              marginTop: 2,
            }}
          >
            {t(route.name === 'chat' ? conversationsLabel : (labels[route.name] ?? 'nav.profile'))}
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
              color={focused ? colors.primary : colors.textTertiary}
              outline={!focused}
            />
          </View>
        ),
        };
      }}
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
      {/* Conversations — course chat rooms and/or the teacher's question threads, as segments
          of ONE tab (the bar has no sixth slot). A real tab when either feature is on, and
          absent entirely when both are off, so nothing advertises a room that cannot open. */}
      <Tabs.Screen
        name="chat"
        options={{
          href: chatEnabled || threadsEnabled ? undefined : null,
          tabBarBadge: chatUnread > 0 ? (chatUnread > 99 ? '99+' : chatUnread) : undefined,
        }}
      />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
