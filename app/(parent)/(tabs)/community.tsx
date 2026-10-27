import { useEffect, useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommunityComingSoon } from '@/components/parent/CommunityComingSoon';
import { ChatInbox, ChatInboxList, InboxChips } from '@/components/chat/ChatInbox';
import { CHAT_FLAG, useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { THREADS_FLAG, useThreadsEnabled, useThreadsFeed, useThreadsUnread } from '@/hooks/useThreads';
import { COMMUNITY_FLAG, useCommunityEnabled, useCommunityUnread } from '@/hooks/useCommunity';
import { BetaChip, BetaLine } from '@/components/ui/Beta';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { ThreadsFeed } from '@/components/threads/ThreadsFeed';
import { CommunityFeed } from '@/components/community/CommunityFeed';
import { Segments } from '@/components/threads/Segments';
import { HUB_SEGMENTS, enabledSegments, hubSegmentItems, type HubSegment } from '@/components/community/hubSegments';
import { ChildrenConsentSheet } from '@/components/threads/ChildrenConsentSheet';
import { arDigits, filterCounts } from '@/components/threads/format';
import { PageHero, type HeroAction } from '@/components/ui/PageHero';
import type { InboxFilter } from '@/chat/inbox';
import { colors, spacing, nav } from '@/theme/index';
import { Surface } from '@/ui/surfaces';
import { useFeatureTermsOnFocus } from '@/hooks/useFeatureTermsOnFocus';

const FEATURE_KEYS = ['community', 'course_chat', 'threads'] as const;

type Segment = HubSegment;
const SEGMENTS = HUB_SEGMENTS;

/**
 * «مجتمعنا» — the parent's centre tab (founder 2026-10-06). Up to three surfaces:
 *
 *  - **مجتمعنا** — the parents' space of each teacher: posts, pictures, reactions, comments,
 *    every member post through the moderation screen (founder 2026-10-28);
 *  - **الدردشة** — the child's course room (read) and a parents' room per course;
 *  - **حكاوي** — the teacher's grade-wide questions, their children's answers.
 *
 * Each appears only while its flag is on; none on → the coming-soon preview. The hero's
 * shield (حكاوي) opens «حكاوي لأولادي», each child's participation.
 */
export default function ParentCommunity() {
  // A feature reached this person but an agreement is still due: bring it back here.
  useFeatureTermsOnFocus(FEATURE_KEYS);
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  const communityEnabled = useCommunityEnabled();
  return (
    <Surface id="screen.parent.community" screen>
      {threadsEnabled || communityEnabled
        ? <ParentConversations />
        : chatEnabled
          ? <ChatInbox role="parent" onOpen={(room) => router.push(`/(parent)/chat/${room}` as Href)} />
          : <CommunityComingSoon />}
    </Surface>
  );
}

function ParentConversations() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  const communityEnabled = useCommunityEnabled();
  const enabled = useMemo(() => enabledSegments({ community: communityEnabled, chat: chatEnabled, threads: threadsEnabled }), [communityEnabled, chatEnabled, threadsEnabled]);
  // A push lands here with `?segment=…`.
  const params = useLocalSearchParams<{ segment?: string }>();
  const [picked, setSegment] = useState<Segment | null>(null);
  useEffect(() => { if (SEGMENTS.includes(params.segment as Segment)) setSegment(params.segment as Segment); }, [params.segment]);
  const segment: Segment = picked && enabled.includes(picked) ? picked : (enabled[0] ?? 'chat');
  const many = enabled.length > 1;
  const showThreads = segment === 'threads';
  const showCommunity = segment === 'community';
  const flag = showCommunity ? COMMUNITY_FLAG : showThreads ? THREADS_FLAG : CHAT_FLAG;
  const [consentOpen, setConsentOpen] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>('all');

  const { data: channels, refetch: refetchChat } = useChatChannels(chatEnabled);
  const { data: unreadThreads, refetch: refetchUnread } = useThreadsUnread(threadsEnabled);
  const { data: feed, refetch: refetchFeed } = useThreadsFeed(threadsEnabled);
  const { data: communityUnread, refetch: refetchCommunity } = useCommunityUnread(communityEnabled, showCommunity);
  const counts = useMemo(() => filterCounts(feed?.threads ?? []), [feed?.threads]);
  const { refreshing, onRefresh } = usePullRefresh(...(chatEnabled ? [refetchChat] : []), ...(threadsEnabled ? [refetchFeed, refetchUnread] : []), ...(communityEnabled ? [refetchCommunity] : []));
  const rooms = useMemo(() => channels ?? [], [channels]);
  const chatUnread = rooms.reduce((n, c) => n + (c.unread || 0), 0);

  const actions: HeroAction[] = showThreads
    ? [{ icon: 'shield', onPress: () => setConsentOpen(true), accessibilityLabel: t('threads.consent_title') }]
    : [];

  const head = (
    <>
      <PageHero
        title={showCommunity ? t('community_space.title_parents') : showThreads ? t('threads.title') : t('community.title')}
        subtitle={showCommunity ? t('community_space.subtitle_parents') : showThreads ? t('threads.subtitle_parent') : t('community.tagline')}
        badge={<BetaChip feature={flag} />}
        actions={actions}
        stats={showThreads && counts.all > 0 ? [
          { value: arDigits(counts.open), label: t('threads.stat_open') },
          { value: arDigits(unreadThreads ?? 0), label: t('threads.stat_new'), warn: (unreadThreads ?? 0) > 0 },
          { value: arDigits(counts.answered), label: t('threads.stat_answered') },
        ] : undefined}
      />
      {many ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -(spacing.xl4 - spacing.sm), marginBottom: spacing.md }}>
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <CommunityFeed
          audience="parents"
          header={head}
          footer={<BetaLine feature={COMMUNITY_FLAG} />}
          onOpen={(id) => router.push(`/(parent)/community/${id}` as Href)}
          extraRefetch={refetchCommunity}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {head}
        {showThreads ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: many ? 0 : -(spacing.xl4 - spacing.sm) }}>
            <ThreadsFeed reader="parent" onOpen={(id) => router.push(`/(parent)/chat/thread/${id}` as Href)} />
          </View>
        ) : (
          <>
            {rooms.length ? (
              <View style={{ paddingBottom: spacing.md }}>
                <InboxChips list={rooms} value={filter} onChange={setFilter} />
              </View>
            ) : null}
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ChatInboxList filter={filter} onOpen={(room) => router.push(`/(parent)/chat/${room}` as Href)} />
            </View>
          </>
        )}
        {/* The note line closes the screen — after the content, never above it. */}
        <BetaLine feature={flag} />
      </ScrollView>
      <ChildrenConsentSheet visible={consentOpen} onClose={() => setConsentOpen(false)} />
    </View>
  );
}
