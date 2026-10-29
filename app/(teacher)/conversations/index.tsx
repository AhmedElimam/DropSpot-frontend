import { useMemo, useState } from 'react';
import { View, RefreshControl, TouchableOpacity, Text } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, nav, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { CHAT_FLAG, useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { COMMUNITY_FLAG, useCommunityEnabled, useCommunitySpaces } from '@/hooks/useCommunity';
import { BetaChip, BetaLine } from '@/components/ui/Beta';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChatInbox, ChatInboxList } from '@/components/chat/ChatInbox';
import { THREADS_FLAG, useThreadsEnabled, useThreadsFeed, useThreadsUnread } from '@/hooks/useThreads';
import { ThreadsFeed } from '@/components/threads/ThreadsFeed';
import { ComposeThreadSheet } from '@/components/threads/ComposeThreadSheet';
import { ReportsSheet, SettingsSheet } from '@/components/threads/ThreadSheets';
import { Segments } from '@/components/threads/Segments';
import { enabledSegments, hubSegmentItems, type HubSegment } from '@/components/community/hubSegments';
import { arDigits, filterCounts } from '@/components/threads/format';
import { CommunityFeed } from '@/components/community/CommunityFeed';
import { AudienceSwitch } from '@/components/community/AudienceSwitch';
import { PageHero, type HeroAction } from '@/components/ui/PageHero';
import { Surface, useHiddenSurfaces } from '@/ui/surfaces';
import { useFeatureTermsOnFocus } from '@/hooks/useFeatureTermsOnFocus';
import type { CommunityAudience } from '@/api/community';

const FEATURE_KEYS = ['community', 'course_chat', 'threads'] as const;

type Segment = HubSegment;

/**
 * The teacher's conversations with their STUDENTS and their families — up to three segments:
 *
 *  - **مجتمعنا** — the platform's two open communities (students, parents), which the teacher
 *    reads, reacts to and reports in, and never posts in (founder 2026-10-28);
 *  - **الدردشة** — the course group rooms they moderate;
 *  - **حكاوي** — the threads (a question to a grade, answers, votes, a timer).
 *
 * They used to sit as segments inside the tickets screen (parents' messages). The founder
 * moved them out (2026-10-12): talking to a class is one of the first things a teacher does.
 * A pushed screen over the tabs, so it carries its own back.
 */
export default function TeacherConversations() {
  // A feature reached this person but an agreement is still due: bring it back here.
  useFeatureTermsOnFocus(FEATURE_KEYS);
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  const communityEnabled = useCommunityEnabled();
  // Chat alone (founder 2026-10-12): the shared conversations screen.
  if (chatEnabled && !threadsEnabled && !communityEnabled) {
    return (
      <Surface id="screen.teacher.conversations" screen>
        <ChatInbox role="teacher" onBack onOpen={(room) => router.push(`/(teacher)/conversations/chat/${room}` as Href)} />
      </Surface>
    );
  }
  return <ConversationsHub />;
}

/** The segments, while more than chat is on. */
function ConversationsHub() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  const communityEnabled = useCommunityEnabled();
  const hiddenSurfaces = useHiddenSurfaces();
  const enabled = useMemo(() => enabledSegments({ community: communityEnabled, chat: chatEnabled, threads: threadsEnabled }, hiddenSurfaces), [communityEnabled, chatEnabled, threadsEnabled, hiddenSurfaces]);
  // Until the teacher picks a side the default follows the flags: the community leads, then chat.
  const [picked, setTab] = useState<Segment | null>(null);
  const tab: Segment = picked && enabled.includes(picked) ? picked : (enabled[0] ?? 'chat');
  const many = enabled.length > 1;
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeKind, setComposeKind] = useState<'question' | 'note'>('question');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [audience, setAudience] = useState<CommunityAudience>('students');

  const { data: channels, refetch: refetchChat } = useChatChannels(chatEnabled);
  const { data: threadsFeed, refetch: refetchThreads } = useThreadsFeed(threadsEnabled);
  const { data: threadsUnread, refetch: refetchThreadsUnread } = useThreadsUnread(threadsEnabled);
  const spacesQ = useCommunitySpaces(communityEnabled);
  const { refreshing, onRefresh } = usePullRefresh(...(chatEnabled ? [refetchChat] : []), ...(threadsEnabled ? [refetchThreads, refetchThreadsUnread] : []), ...(communityEnabled ? [spacesQ.refetch] : []));

  const chatUnread = (channels ?? []).reduce((n, c) => n + (c.unread || 0), 0);
  const showThreads = tab === 'threads';
  const showCommunity = tab === 'community';
  const showChat = tab === 'chat';
  const threadsBadge = (threadsUnread ?? 0) + (threadsFeed?.open_reports ?? 0);
  const communityUnread = (spacesQ.data?.spaces ?? []).reduce((n, s) => n + (s.unread || 0), 0);
  const openThread = (id: number) => router.push(`/(teacher)/conversations/threads/${id}` as Href);
  const counts = useMemo(() => filterCounts(threadsFeed?.threads ?? []), [threadsFeed?.threads]);
  const isThreadsTeacher = !!threadsFeed?.settings;
  const isThreadsStaff = isThreadsTeacher || threadsFeed?.open_reports !== undefined;
  const flag = showCommunity ? COMMUNITY_FLAG : showThreads ? THREADS_FLAG : CHAT_FLAG;

  // The hero carries حكاوي's tools (reports queue, settings). The community has none here: ops moderate it.
  const heroActions: HeroAction[] = showThreads ? [
    ...(isThreadsStaff ? [{ icon: 'flag' as const, onPress: () => setReportsOpen(true), accessibilityLabel: t('threads.reports'), badge: threadsFeed?.open_reports ?? 0 }] : []),
    ...(isThreadsTeacher ? [{ icon: 'settings' as const, onPress: () => setSettingsOpen(true), accessibilityLabel: t('threads.settings') }] : []),
  ] : [];

  const segments = (
    <Segments
      value={tab}
      onChange={setTab}
      items={hubSegmentItems(enabled, { community: t('community_space.tab'), chat: t('chat.tab_chat'), threads: t('threads.tab') }, { community: communityUnread, chat: chatUnread, threads: threadsBadge })}
    />
  );

  // ONE segment control, pinned at the top for every side (founder 2026-10-28): the same element
  // in the same place whichever side is open, so its pill slides into مجتمعنا too. The bar
  // carries back; on the community side it also carries the students / parents switch.
  const pinned = many || showCommunity;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/resolve' as never));
  const bar = pinned ? (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md, backgroundColor: gradients.hero[0], zIndex: 1 }}>
      {/* Back on its own slim row with the screen's name; the segments get the whole width under
          it (founder 2026-10-28: the arrow crowded the segments once a count showed beside one). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TouchableOpacity onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back')}
          style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, alignItems: 'center', justifyContent: 'center' }}>
          {/* RTL: "back" points to the right. */}
          <Icon name="forward" size={20} color={colors.onHero} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.onHero }} numberOfLines={1}>{t('chat.conversations')}</Text>
      </View>
      {many ? segments : null}
      {showCommunity ? (
        // The teacher reads TWO communities: which one is in front.
        <Surface id="community.audience_switch"><AudienceSwitch value={audience} onChange={setAudience} spaces={spacesQ.data?.spaces ?? []} /></Surface>
      ) : null}
    </View>
  ) : null;

  const head = (
    <PageHero
      onBack={!pinned}
      inset={pinned ? 0 : undefined}
      title={showThreads ? t('threads.title') : pinned ? t('chat.tab_chat') : t('chat.conversations')}
      subtitle={showThreads
          ? t('threads.subtitle_teacher')
          : showChat
            ? t('chat.members_count', { count: (channels ?? []).length })
            : t('chat.conversations_sub')}
      badge={<BetaChip feature={flag} />}
      actions={heroActions}
      stats={showThreads && counts.all > 0 ? [
        { value: arDigits(counts.open), label: t('threads.stat_open') },
        { value: arDigits(counts.waiting), label: t('threads.stat_waiting_teacher'), warn: counts.waiting > 0 },
        { value: arDigits(counts.answered), label: t('threads.stat_answered') },
      ] : undefined}
    />
  );

  return (
    <Surface id="screen.teacher.conversations" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {bar}
      {showCommunity ? (
        <CommunityFeed
          audience={audience}
          footer={<BetaLine feature={COMMUNITY_FLAG} />}
          onOpen={(id) => router.push(`/(teacher)/conversations/community/${id}` as Href)}
          extraRefetch={spacesQ.refetch}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom }}
        />
      ) : (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Surface id="teacher.conversations.hero">{head}</Surface>

        {showThreads ? (
          <Surface id="teacher.conversations.threads">
          <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg }}>
            <ThreadsFeed
              onOpen={openThread}
              onCompose={(kind) => { setComposeKind(kind); setComposeOpen(true); }}
              onSettings={() => setSettingsOpen(true)}
            />
            <ComposeThreadSheet
              visible={composeOpen}
              initialKind={composeKind}
              grades={threadsFeed?.grades ?? []}
              settings={threadsFeed?.settings}
              limits={threadsFeed?.limits}
              onClose={() => setComposeOpen(false)}
              onCreated={(id) => { setComposeOpen(false); openThread(id); }}
            />
            <SettingsSheet visible={settingsOpen} settings={threadsFeed?.settings} onClose={() => setSettingsOpen(false)} />
            <ReportsSheet visible={reportsOpen} onClose={() => setReportsOpen(false)} onOpenThread={(id) => { setReportsOpen(false); openThread(id); }} />
          </View>
          </Surface>
        ) : showChat ? (
          <Surface id="teacher.conversations.chat">
          <View style={{ marginHorizontal: spacing.lg, marginTop: -spacing.lg }}>
            <ChatInboxList onOpen={(room) => router.push(`/(teacher)/conversations/chat/${room}` as Href)} />
          </View>
          </Surface>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <EmptyState icon="chat" title={t('common.not_available')} />
          </View>
        )}
        {/* The note line closes the screen — after the content, never above it. */}
        <BetaLine feature={flag} />
      </ScrollView>
      )}
    </View>
    </Surface>
  );
}
