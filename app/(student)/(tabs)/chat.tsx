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
import { COMMUNITY_FLAG, useCommunityEnabled, useCommunityUnread } from '@/hooks/useCommunity';
import { BetaChip, BetaLine } from '@/components/ui/Beta';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { ChatInbox, ChatInboxList } from '@/components/chat/ChatInbox';
import { ThreadsFeed } from '@/components/threads/ThreadsFeed';
import { CommunityFeed } from '@/components/community/CommunityFeed';
import { Icon } from '@/components/ui/Icon';
import { Segments } from '@/components/threads/Segments';
import { HUB_SEGMENTS, enabledSegments, hubSegmentItems, type HubSegment } from '@/components/community/hubSegments';
import { arDigits, filterCounts } from '@/components/threads/format';
import { TogetherComingSoon } from '@/components/student/TogetherComingSoon';
import { Surface } from '@/ui/surfaces';
import { useFeatureTermsOnFocus } from '@/hooks/useFeatureTermsOnFocus';

const FEATURE_KEYS = ['community', 'course_chat', 'threads'] as const;

type Segment = HubSegment;
const SEGMENTS = HUB_SEGMENTS;

/**
 * The student's centre tab. Up to three surfaces, one tab (the bar has no sixth slot):
 *
 *  - **مجتمعنا** — the teacher's community: posts, pictures, reactions, comments, every member
 *    post through the moderation screen (founder 2026-10-28);
 *  - **الدردشة** — one room per enrolled course;
 *  - **حكاوي** — the teacher's grade-wide questions.
 *
 * Each appears only while its flag is on; with one flag the segments vanish and the tab is
 * that one surface. The community leads when it is on, then chat (founder 2026-10-15).
 */
export default function StudentChatTab() {
  // A feature reached this person but an agreement is still due: bring it back here.
  useFeatureTermsOnFocus(FEATURE_KEYS);
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  const communityEnabled = useCommunityEnabled();
  return (
    <Surface id="screen.student.chat" screen>
      {threadsEnabled || communityEnabled
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
  const communityEnabled = useCommunityEnabled();
  const enabled = useMemo(() => enabledSegments({ community: communityEnabled, chat: chatEnabled, threads: threadsEnabled }), [communityEnabled, chatEnabled, threadsEnabled]);
  // Until the reader picks a side, the default follows the flags (they may load after mount).
  const [picked, setSegment] = useState<Segment | null>(null);
  // A push lands with `?segment=…`.
  const params = useLocalSearchParams<{ segment?: string }>();
  useEffect(() => { if (SEGMENTS.includes(params.segment as Segment)) setSegment(params.segment as Segment); }, [params.segment]);
  const segment: Segment = picked && enabled.includes(picked) ? picked : (enabled[0] ?? 'chat');
  const many = enabled.length > 1;
  const showThreads = segment === 'threads';
  const showCommunity = segment === 'community';
  const flag = showCommunity ? COMMUNITY_FLAG : showThreads ? THREADS_FLAG : CHAT_FLAG;

  const { data: channels, refetch: refetchChat } = useChatChannels(chatEnabled);
  const { data: unreadThreads, refetch: refetchUnread } = useThreadsUnread(threadsEnabled);
  const { data: feed, refetch: refetchFeed } = useThreadsFeed(threadsEnabled);
  const { data: communityUnread, refetch: refetchCommunity } = useCommunityUnread(communityEnabled, showCommunity);
  const counts = useMemo(() => filterCounts(feed?.threads ?? []), [feed?.threads]);
  const { refreshing, onRefresh } = usePullRefresh(...(chatEnabled ? [refetchChat] : []), ...(threadsEnabled ? [refetchFeed, refetchUnread] : []), ...(communityEnabled ? [refetchCommunity] : []));
  const chatUnread = (channels ?? []).reduce((n, c) => n + (c.unread || 0), 0);

  const head = (
    <>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: many ? spacing.xl4 + spacing.md : spacing.xl4 }}
      >
        {/* RTL: 'row' only — the «تجريبي» mark trails the title (one per screen). */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.onHero, letterSpacing: -0.5, flexShrink: 1 }}>
            {showCommunity ? t('community_space.title_students') : showThreads ? t('threads.title') : t('chat.title')}
          </Text>
          <BetaChip feature={flag} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm }}>
          <Icon name={showCommunity ? 'people' : showThreads ? 'question' : 'eye'} size={15} color={colors.onHeroSoft} outline style={{ marginTop: 3 }} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.onHeroSoft }}>
            {showCommunity ? t('community_space.subtitle_students') : showThreads ? t('threads.subtitle_student') : t('chat.subtitle')}
          </Text>
        </View>
        {showThreads && counts.all > 0 ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <HeroCount icon="timer" value={counts.open} label={t('threads.stat_open')} />
            <HeroCount icon="sparkles" value={unreadThreads ?? 0} label={t('threads.stat_new')} accent />
            <HeroCount icon="success" value={counts.answered} label={t('threads.stat_answered')} />
          </View>
        ) : null}
      </LinearGradient>

      {many ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl - 4, marginBottom: spacing.md }}>
          <Segments
            value={segment}
            onChange={setSegment}
            items={hubSegmentItems(enabled, { community: t('community_space.tab'), chat: t('chat.tab_chat'), threads: t('threads.tab') }, { community: communityUnread ?? 0, chat: chatUnread, threads: unreadThreads ?? 0 })}
          />
        </View>
      ) : null}
    </>
  );

  if (showCommunity) {
    return (
      <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
        <CommunityFeed
          audience="students"
          header={head}
          footer={<BetaLine feature={COMMUNITY_FLAG} />}
          onOpen={(id) => router.push(`/(student)/community/${id}` as Href)}
          extraRefetch={refetchCommunity}
          contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {head}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: many ? 0 : -spacing.xl }}>
          {showThreads ? (
            <ThreadsFeed onOpen={(id) => router.push(`/(student)/chat/thread/${id}` as Href)} />
          ) : (
            <ChatInboxList onOpen={(room) => router.push(`/(student)/chat/${room}` as Href)} />
          )}
        </View>
        {/* The note line closes the screen — after the content, never above it. */}
        <BetaLine feature={flag} />
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
