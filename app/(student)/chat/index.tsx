import { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { useThreadsEnabled, useThreadsFeed, useThreadsUnread } from '@/hooks/useThreads';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { ChatRoomsList } from '@/components/chat/ChatRoomsList';
import { ThreadsFeed } from '@/components/threads/ThreadsFeed';
import { Icon, type IconName } from '@/components/ui/Icon';

type Segment = 'threads' | 'chat';

/**
 * The student's conversations tab. Two surfaces, one tab (the bar has no sixth slot):
 *
 *  - **النقاشات** — the teacher's grade-wide questions: answer, vote, watch the answer video;
 *  - **الدردشة** — one room per enrolled course.
 *
 * Each appears only while its flag is on; with one flag the segments vanish and the tab is
 * that one surface. Threads lead when both are on: a question with a running clock ages
 * faster than a room does.
 */
export default function StudentConversations() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  const [segment, setSegment] = useState<Segment>(threadsEnabled ? 'threads' : 'chat');
  const both = chatEnabled && threadsEnabled;
  const showThreads = threadsEnabled && (segment === 'threads' || !chatEnabled);

  const { data: channels, refetch: refetchChat } = useChatChannels(chatEnabled);
  const { data: unreadThreads, refetch: refetchUnread } = useThreadsUnread(threadsEnabled);
  const { refetch: refetchFeed } = useThreadsFeed(threadsEnabled);
  const { refreshing, onRefresh } = usePullRefresh(...(chatEnabled ? [refetchChat] : []), ...(threadsEnabled ? [refetchFeed, refetchUnread] : []));
  const chatUnread = (channels ?? []).reduce((n, c) => n + (c.unread || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: both ? spacing.xl4 + spacing.md : spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', letterSpacing: -0.5 }}>
            {showThreads ? t('threads.title') : t('chat.title')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm }}>
            <Icon name={showThreads ? 'question' : 'eye'} size={15} color="rgba(255,255,255,0.7)" outline style={{ marginTop: 3 }} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.72)' }}>
              {showThreads ? t('threads.subtitle_student') : t('chat.subtitle')}
            </Text>
          </View>
        </LinearGradient>

        {both ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: -spacing.xl, marginBottom: spacing.md }}>
            <SegmentButton label={t('threads.tab')} icon="threads" active={segment === 'threads'} badge={unreadThreads ?? 0} onPress={() => setSegment('threads')} />
            <SegmentButton label={t('chat.tab_chat')} icon="chat" active={segment === 'chat'} badge={chatUnread} onPress={() => setSegment('chat')} />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: both ? 0 : -spacing.xl }}>
          {showThreads ? (
            <ThreadsFeed onOpen={(id) => router.push(`/(student)/chat/thread/${id}` as Href)} />
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadows.sm }}>
              <ChatRoomsList onOpen={(courseId) => router.push(`/(student)/chat/${courseId}` as Href)} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SegmentButton({ label, icon, active, badge, onPress }: { label: string; icon: IconName; active: boolean; badge: number; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        minHeight: 46, borderRadius: radius.lg,
        backgroundColor: active ? colors.brand : colors.surface,
        borderWidth: 1, borderColor: active ? colors.brand : colors.border,
        ...shadows.sm,
      }}
    >
      <Icon name={icon} size={18} color={active ? '#fff' : colors.textSecondary} outline={!active} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: active ? '#fff' : colors.textSecondary }}>{label}</Text>
      {badge > 0 ? (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: active ? 'rgba(255,255,255,0.28)' : colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
