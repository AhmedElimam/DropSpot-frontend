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
import { useBetaFeature } from '@/hooks/useBetaFeature';
import { BetaLine } from '@/components/ui/Beta';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { ThreadsFeed } from '@/components/threads/ThreadsFeed';
import { Segments } from '@/components/threads/Segments';
import { ChildrenConsentSheet } from '@/components/threads/ChildrenConsentSheet';
import { arDigits, filterCounts } from '@/components/threads/format';
import { PageHero, type HeroAction } from '@/components/ui/PageHero';
import type { InboxFilter } from '@/chat/inbox';
import { colors, spacing, nav } from '@/theme/index';
import { Surface } from '@/ui/surfaces';
import { useFeatureTermsOnFocus } from '@/hooks/useFeatureTermsOnFocus';

const FEATURE_KEYS = ['course_chat', 'threads'] as const;

type Segment = 'chat' | 'threads';

/**
 * «مجتمعنا» — the parent's centre tab (founder 2026-10-06): the child's course chat and a parents'
 * chat per course. The rooms themselves once the chat is on (2026-10-12) — one card per course
 * with its parents' room and the child's room the parent follows; until then the coming-soon
 * preview. «أبنائي» moved to a stack screen opened from Home's children section.
 *
 * With حكاوي on (founder 2026-10-15: «parents, like chat, can see teacher posts and the comments
 * of their children and the other children on that post»), the same two segments as the
 * student's tab — الدردشة first, حكاوي second — or حكاوي alone while the chat is off. The hero's
 * shield opens «حكاوي لأولادي», each child's participation.
 */
export default function ParentCommunity() {
  // Chat / حكاوي reached this person but an agreement is still due: bring it back here.
  useFeatureTermsOnFocus(FEATURE_KEYS);
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  return (
    <Surface id="screen.parent.community" screen>
      {threadsEnabled
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
  // A push about حكاوي lands here with `?segment=threads`.
  const params = useLocalSearchParams<{ segment?: string }>();
  const [picked, setSegment] = useState<Segment | null>(null);
  useEffect(() => { if (params.segment === 'threads' || params.segment === 'chat') setSegment(params.segment); }, [params.segment]);
  const segment: Segment = picked ?? (chatEnabled ? 'chat' : 'threads');
  const both = chatEnabled && threadsEnabled;
  const showThreads = threadsEnabled && (segment === 'threads' || !chatEnabled);
  const [consentOpen, setConsentOpen] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>('all');
  // Reached this parent as a beta (feature targeting): marked on the segment and under the hero.
  const chatBeta = useBetaFeature(CHAT_FLAG);
  const threadsBeta = useBetaFeature(THREADS_FLAG);

  const { data: channels, refetch: refetchChat } = useChatChannels(chatEnabled);
  const { data: unreadThreads, refetch: refetchUnread } = useThreadsUnread(threadsEnabled);
  const { data: feed, refetch: refetchFeed } = useThreadsFeed(threadsEnabled);
  const counts = useMemo(() => filterCounts(feed?.threads ?? []), [feed?.threads]);
  const { refreshing, onRefresh } = usePullRefresh(...(chatEnabled ? [refetchChat] : []), ...(threadsEnabled ? [refetchFeed, refetchUnread] : []));
  const rooms = useMemo(() => channels ?? [], [channels]);
  const chatUnread = rooms.reduce((n, c) => n + (c.unread || 0), 0);

  const actions: HeroAction[] = showThreads
    ? [{ icon: 'shield', onPress: () => setConsentOpen(true), accessibilityLabel: t('threads.consent_title') }]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <PageHero
          title={showThreads ? t('threads.title') : t('community.title')}
          subtitle={showThreads ? t('threads.subtitle_parent') : t('community.tagline')}
          actions={actions}
          stats={showThreads && counts.all > 0 ? [
            { value: arDigits(counts.open), label: t('threads.stat_open') },
            { value: arDigits(unreadThreads ?? 0), label: t('threads.stat_new'), warn: (unreadThreads ?? 0) > 0 },
            { value: arDigits(counts.answered), label: t('threads.stat_answered') },
          ] : undefined}
        >
          <BetaLine feature={showThreads ? THREADS_FLAG : CHAT_FLAG} style={{ paddingHorizontal: 0, paddingTop: spacing.md }} />
        </PageHero>

        {both ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: -(spacing.xl4 - spacing.sm), marginBottom: spacing.md }}>
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

        {showThreads ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: both ? 0 : -(spacing.xl4 - spacing.sm) }}>
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
      </ScrollView>
      <ChildrenConsentSheet visible={consentOpen} onClose={() => setConsentOpen(false)} />
    </View>
  );
}
