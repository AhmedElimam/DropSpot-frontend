import { useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { colors, spacing, nav } from '@/theme/index';
import { CHAT_FLAG, useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { useBetaFeature } from '@/hooks/useBetaFeature';
import { BetaLine } from '@/components/ui/Beta';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChatInbox, ChatInboxList } from '@/components/chat/ChatInbox';
import { THREADS_FLAG, useThreadsEnabled, useThreadsFeed, useThreadsUnread } from '@/hooks/useThreads';
import { ThreadsFeed } from '@/components/threads/ThreadsFeed';
import { ComposeThreadSheet } from '@/components/threads/ComposeThreadSheet';
import { ReportsSheet, SettingsSheet } from '@/components/threads/ThreadSheets';
import { Segments } from '@/components/threads/Segments';
import { arDigits, filterCounts } from '@/components/threads/format';
import { PageHero, type HeroAction } from '@/components/ui/PageHero';
import { Surface } from '@/ui/surfaces';
import { useFeatureTermsOnFocus } from '@/hooks/useFeatureTermsOnFocus';

const FEATURE_KEYS = ['course_chat', 'threads'] as const;

/**
 * The teacher's conversations with their STUDENTS — two segments:
 *
 *  - **حكاوي** — the threads (a question to a grade, answers, votes, a timer; founder
 *    2026-10-15: «call it حكاوي»);
 *  - **الدردشة** — the course group rooms they moderate.
 *
 * They used to sit as segments inside the tickets screen (parents' messages). The founder
 * moved them out (2026-10-12): talking to a class is one of the first things a teacher
 * does, not a tab behind the parents' tickets — so this is its own screen, reached from a
 * home shortcut (with the unread count) and the top of the follow-up hub. Tickets stay
 * what they were: the parents' channel.
 *
 * A pushed screen over the tabs, so it carries its own back.
 */
export default function TeacherConversations() {
  // Chat / حكاوي reached this person but an agreement is still due: bring it back here.
  useFeatureTermsOnFocus(FEATURE_KEYS);
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  // Chat alone (threads hidden, founder 2026-10-12): the shared conversations screen.
  if (chatEnabled && !threadsEnabled) {
    return (
      <Surface id="screen.teacher.conversations" screen>
        <ChatInbox role="teacher" onBack onOpen={(room) => router.push(`/(teacher)/conversations/chat/${room}` as Href)} />
      </Surface>
    );
  }
  return <ConversationsWithThreads />;
}

/** Threads and chat as two segments, while threads are on. */
function ConversationsWithThreads() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  // Chat first (founder 2026-10-15); until the teacher picks a side the default follows the flags.
  const [picked, setTab] = useState<'threads' | 'chat' | null>(null);
  const tab = picked ?? (chatEnabled ? 'chat' : 'threads');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeKind, setComposeKind] = useState<'question' | 'note'>('question');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  // Reached this teacher as a beta (feature targeting): marked on the segment and under the hero.
  const chatBeta = useBetaFeature(CHAT_FLAG);
  const threadsBeta = useBetaFeature(THREADS_FLAG);

  const { data: channels, refetch: refetchChat } = useChatChannels(chatEnabled);
  const { data: threadsFeed, refetch: refetchThreads } = useThreadsFeed(threadsEnabled);
  const { data: threadsUnread, refetch: refetchThreadsUnread } = useThreadsUnread(threadsEnabled);
  const { refreshing, onRefresh } = usePullRefresh(...(chatEnabled ? [refetchChat] : []), ...(threadsEnabled ? [refetchThreads, refetchThreadsUnread] : []));

  const chatUnread = (channels ?? []).reduce((n, c) => n + (c.unread || 0), 0);
  const showThreads = threadsEnabled && tab === 'threads';
  const showChat = chatEnabled && !showThreads;
  const threadsBadge = (threadsUnread ?? 0) + (threadsFeed?.open_reports ?? 0);
  const openThread = (id: number) => router.push(`/(teacher)/conversations/threads/${id}` as Href);
  const counts = useMemo(() => filterCounts(threadsFeed?.threads ?? []), [threadsFeed?.threads]);
  const isThreadsTeacher = !!threadsFeed?.settings;
  const isThreadsStaff = isThreadsTeacher || threadsFeed?.open_reports !== undefined;
  // The hero carries حكاوي's two tools: the reports queue (teacher + assistant) and the settings (teacher).
  const heroActions: HeroAction[] = showThreads ? [
    ...(isThreadsStaff ? [{ icon: 'flag' as const, onPress: () => setReportsOpen(true), accessibilityLabel: t('threads.reports'), badge: threadsFeed?.open_reports ?? 0 }] : []),
    ...(isThreadsTeacher ? [{ icon: 'settings' as const, onPress: () => setSettingsOpen(true), accessibilityLabel: t('threads.settings') }] : []),
  ] : [];

  return (
    <Surface id="screen.teacher.conversations" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Surface id="teacher.conversations.hero">
          <PageHero
            onBack
            title={showThreads ? t('threads.title') : t('chat.conversations')}
            subtitle={showThreads
              ? t('threads.subtitle_teacher')
              : showChat
                ? t('chat.members_count', { count: (channels ?? []).length })
                : t('chat.conversations_sub')}
            actions={heroActions}
            stats={showThreads && counts.all > 0 ? [
              { value: arDigits(counts.open), label: t('threads.stat_open') },
              { value: arDigits(counts.waiting), label: t('threads.stat_waiting_teacher'), warn: counts.waiting > 0 },
              { value: arDigits(counts.answered), label: t('threads.stat_answered') },
            ] : undefined}
          >
            <BetaLine feature={showThreads ? THREADS_FLAG : CHAT_FLAG} style={{ marginHorizontal: 0, marginTop: spacing.md }} />
          </PageHero>
        </Surface>

        {threadsEnabled && chatEnabled ? (
          <Surface id="teacher.conversations.segments">
          <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl, marginBottom: spacing.md }}>
            <Segments
              value={tab}
              onChange={setTab}
              items={[
                { key: 'chat', label: t('chat.tab_chat'), icon: 'chat', badge: chatUnread, beta: chatBeta },
                { key: 'threads', label: t('threads.tab'), icon: 'threads', badge: threadsBadge, beta: threadsBeta },
              ]}
            />
          </View>
          </Surface>
        ) : null}

        {showThreads ? (
          <Surface id="teacher.conversations.threads">
          <View style={{ paddingHorizontal: spacing.lg, marginTop: chatEnabled ? 0 : -spacing.lg }}>
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
          <View style={{ marginHorizontal: spacing.lg, marginTop: threadsEnabled ? 0 : -spacing.lg }}>
            <ChatInboxList onOpen={(room) => router.push(`/(teacher)/conversations/chat/${room}` as Href)} />
          </View>
          </Surface>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <EmptyState icon="chat" title={t('common.not_available')} />
          </View>
        )}
      </ScrollView>
    </View>
    </Surface>
  );
}
