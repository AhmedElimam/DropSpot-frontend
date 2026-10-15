import { useEffect, useMemo, useState } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients } from '@/theme/index';
import { CHAT_FLAG, useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { THREADS_FLAG, useThreadsEnabled, useThreadsFeed, useThreadsUnread } from '@/hooks/useThreads';
import { useBetaFeature } from '@/hooks/useBetaFeature';
import { BetaLine } from '@/components/ui/Beta';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { ChatInbox, ChatInboxList } from '@/components/chat/ChatInbox';
import { ThreadsFeed } from '@/components/threads/ThreadsFeed';
import { Icon } from '@/components/ui/Icon';
import { Segments } from '@/components/threads/Segments';
import { arDigits, filterCounts } from '@/components/threads/format';
import { TogetherComingSoon } from '@/components/student/TogetherComingSoon';
import { Surface } from '@/ui/surfaces';

type Segment = 'threads' | 'chat';

/**
 * The student's conversations tab. Two surfaces, one tab (the bar has no sixth slot):
 *
 *  - **حكاوي** — the teacher's grade-wide questions: answer, vote, watch the answer video
 *    (founder 2026-10-15: «call it حكاوي»);
 *  - **الدردشة** — one room per enrolled course.
 *
 * Each appears only while its flag is on; with one flag the segments vanish and the tab is
 * that one surface. Chat leads when both are on (founder 2026-10-15: «make the chat first»).
 */
export default function StudentChatTab() {
  // «مجموعاتي» (main, 2026-10-06): the coming-soon screen while both flags are off.
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  return (
    <Surface id="screen.student.chat" screen>
      {threadsEnabled
        ? <StudentConversations />
        : chatEnabled
          ? <ChatInbox role="student" onOpen={(room) => router.push(`/(student)/chat/${room}` as Href)} />
          : <TogetherComingSoon />}
    </Surface>
  );
}

function StudentConversations() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  // Until the reader picks a side, the default follows the flags (they may load after mount).
  const [picked, setSegment] = useState<Segment | null>(null);
  // A push about حكاوي (e.g. a parent changed the student's part) lands with `?segment=threads`.
  const params = useLocalSearchParams<{ segment?: string }>();
  useEffect(() => { if (params.segment === 'threads' || params.segment === 'chat') setSegment(params.segment); }, [params.segment]);
  const segment: Segment = picked ?? (chatEnabled ? 'chat' : 'threads');
  const both = chatEnabled && threadsEnabled;
  const showThreads = threadsEnabled && (segment === 'threads' || !chatEnabled);
  // Reached this student as a beta (feature targeting): marked on the segment and under the hero.
  const chatBeta = useBetaFeature(CHAT_FLAG);
  const threadsBeta = useBetaFeature(THREADS_FLAG);

  const { data: channels, refetch: refetchChat } = useChatChannels(chatEnabled);
  const { data: unreadThreads, refetch: refetchUnread } = useThreadsUnread(threadsEnabled);
  const { data: feed, refetch: refetchFeed } = useThreadsFeed(threadsEnabled);
  const counts = useMemo(() => filterCounts(feed?.threads ?? []), [feed?.threads]);
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
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.onHero, letterSpacing: -0.5 }}>
            {showThreads ? t('threads.title') : t('chat.title')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm }}>
            <Icon name={showThreads ? 'question' : 'eye'} size={15} color={colors.onHeroSoft} outline style={{ marginTop: 3 }} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.onHeroSoft }}>
              {showThreads ? t('threads.subtitle_student') : t('chat.subtitle')}
            </Text>
          </View>
          {showThreads && counts.all > 0 ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <HeroCount icon="timer" value={counts.open} label={t('threads.stat_open')} />
              <HeroCount icon="sparkles" value={unreadThreads ?? 0} label={t('threads.stat_new')} accent />
              <HeroCount icon="success" value={counts.answered} label={t('threads.stat_answered')} />
            </View>
          ) : null}
          <BetaLine feature={showThreads ? THREADS_FLAG : CHAT_FLAG} style={{ paddingHorizontal: 0, paddingTop: spacing.md }} />
        </LinearGradient>

        {both ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl - 4, marginBottom: spacing.md }}>
            <Segments
              value={segment}
              onChange={setSegment}
              items={[
                { key: 'chat', label: t('chat.tab_chat'), icon: 'chat', badge: chatUnread, beta: chatBeta },
                { key: 'threads', label: t('threads.tab'), icon: 'threads', badge: unreadThreads ?? 0, beta: threadsBeta },
              ]}
            />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: both ? 0 : -spacing.xl }}>
          {showThreads ? (
            <ThreadsFeed onOpen={(id) => router.push(`/(student)/chat/thread/${id}` as Href)} />
          ) : (
            <ChatInboxList onOpen={(room) => router.push(`/(student)/chat/${room}` as Href)} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** A glass count on the hero: how many rounds are open, new, answered. */
function HeroCount({ icon, value, label, accent }: { icon: 'timer' | 'sparkles' | 'success'; value: number; label: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder }}>
      <Icon name={icon} size={16} color={accent && value > 0 ? colors.accent : colors.onHeroSoft} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: accent && value > 0 ? colors.accent : colors.onHero }} numberOfLines={1}>{arDigits(value)}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.onHeroSoft }} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}
