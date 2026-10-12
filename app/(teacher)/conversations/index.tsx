import { useState } from 'react';
import { View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav } from '@/theme/index';
import { useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { ChatInbox, ChatInboxList } from '@/components/chat/ChatInbox';
import { useThreadsEnabled, useThreadsFeed, useThreadsUnread } from '@/hooks/useThreads';
import { ThreadsFeed } from '@/components/threads/ThreadsFeed';
import { ComposeThreadSheet } from '@/components/threads/ComposeThreadSheet';
import { ReportsSheet, SettingsSheet } from '@/components/threads/ThreadSheets';
import type { IconName } from '@/components/ui/Icon';
import { PageHero } from '@/components/ui/PageHero';
import { Surface } from '@/ui/surfaces';

/**
 * The teacher's conversations with their STUDENTS — two segments:
 *
 *  - **النقاشات** — the threads (a question to a grade, answers, votes, a timer);
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
  const [tab, setTab] = useState<'threads' | 'chat'>(threadsEnabled ? 'threads' : 'chat');
  const [composeOpen, setComposeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const { data: channels, refetch: refetchChat } = useChatChannels(chatEnabled);
  const { data: threadsFeed, refetch: refetchThreads } = useThreadsFeed(threadsEnabled);
  const { data: threadsUnread, refetch: refetchThreadsUnread } = useThreadsUnread(threadsEnabled);
  const { refreshing, onRefresh } = usePullRefresh(...(chatEnabled ? [refetchChat] : []), ...(threadsEnabled ? [refetchThreads, refetchThreadsUnread] : []));

  const chatUnread = (channels ?? []).reduce((n, c) => n + (c.unread || 0), 0);
  const showThreads = threadsEnabled && tab === 'threads';
  const showChat = chatEnabled && !showThreads;
  const threadsBadge = (threadsUnread ?? 0) + (threadsFeed?.open_reports ?? 0);
  const openThread = (id: number) => router.push(`/(teacher)/conversations/threads/${id}` as Href);

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
            title={t('chat.conversations')}
            subtitle={showThreads
              ? t('threads.subtitle_teacher')
              : showChat
                ? t('chat.members_count', { count: (channels ?? []).length })
                : t('chat.conversations_sub')}
          />
        </Surface>

        {threadsEnabled && chatEnabled ? (
          <Surface id="teacher.conversations.segments">
          <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: -spacing.lg, marginBottom: spacing.md }}>
            <Segment label={t('threads.tab')} icon="threads" active={tab === 'threads'} badge={threadsBadge} onPress={() => setTab('threads')} />
            <Segment label={t('chat.tab_chat')} icon="chat" active={tab === 'chat'} badge={chatUnread} onPress={() => setTab('chat')} />
          </View>
          </Surface>
        ) : null}

        {showThreads ? (
          <Surface id="teacher.conversations.threads">
          <View style={{ paddingHorizontal: spacing.lg, marginTop: chatEnabled ? 0 : -spacing.lg }}>
            <ThreadsFeed
              onOpen={openThread}
              onCompose={() => setComposeOpen(true)}
              onSettings={() => setSettingsOpen(true)}
              onReports={() => setReportsOpen(true)}
            />
            <ComposeThreadSheet
              visible={composeOpen}
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

function Segment({ label, icon, active, badge, onPress }: {
  label: string;
  icon: IconName;
  active: boolean;
  badge: number;
  onPress: () => void;
}) {
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
      <Icon name={icon} size={18} color={active ? colors.onPrimary : colors.textSecondary} outline={!active} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: active ? colors.onPrimary : colors.textSecondary }}>{label}</Text>
      {badge > 0 ? (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: active ? 'rgba(255,255,255,0.28)' : colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onPrimary }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
