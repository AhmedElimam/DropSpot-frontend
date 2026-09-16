import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useTickets } from '@/hooks/useTickets';
import { useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { ChatRoomsList } from '@/components/chat/ChatRoomsList';

// Left-edge accent per ticket state.
const statusColors: Record<string, [string, string]> = {
  open: [colors.brand, colors.brandDeep],
  in_progress: [colors.warning, colors.warningDark],
  resolved: [colors.success, colors.successDark],
  closed: [colors.textTertiary, colors.textSecondary],
};

const priorityColors: Record<string, string> = {
  low: colors.success,
  medium: colors.warning,
  high: colors.danger,
};

/**
 * The teacher's conversations, in one tab with two segments (founder 2026-09-13):
 *
 *  - **الدردشة** — the course group rooms they moderate;
 *  - **التذاكر** — the threads parents opened with them.
 *
 * Both are "someone is talking to me and expects an answer", so they belong behind one tab
 * rather than competing for a sixth slot on a five-tab bar. The segment defaults to Chat
 * when the feature is on, because a class room ages faster than a ticket does — and when
 * the flag is off, the segments do not appear at all and this is the ticket list it was.
 */
export default function TeacherConversations() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chatEnabled = useChatEnabled();
  const [tab, setTab] = useState<'chat' | 'tickets'>(chatEnabled ? 'chat' : 'tickets');

  const { data: tickets, isLoading, isError, refetch } = useTickets();
  const { data: channels, refetch: refetchChat } = useChatChannels(chatEnabled);
  const { refreshing, onRefresh } = usePullRefresh(refetch, ...(chatEnabled ? [refetchChat] : []));

  const chatUnread = (channels ?? []).reduce((n, c) => n + (c.unread || 0), 0);
  const openTickets = (tickets ?? []).filter((x) => x.status === 'open' || x.status === 'in_progress').length;
  const showChat = chatEnabled && tab === 'chat';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl4 + insets.top, paddingBottom: chatEnabled ? spacing.xl : spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.white, letterSpacing: -0.5 }}>
            {chatEnabled ? t('chat.conversations') : t('tickets.title')}
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
            {showChat
              ? t('chat.members_count', { count: (channels ?? []).length })
              : t('tickets.count', { count: tickets?.length ?? 0 })}
          </Text>
        </LinearGradient>

        {chatEnabled ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: -spacing.lg, marginBottom: spacing.md }}>
            <Segment label={t('chat.tab_chat')} icon="chat" active={tab === 'chat'} badge={chatUnread} onPress={() => setTab('chat')} />
            <Segment label={t('chat.tab_tickets')} icon="tickets" active={tab === 'tickets'} badge={openTickets} onPress={() => setTab('tickets')} />
          </View>
        ) : null}

        {showChat ? (
          <View style={{ backgroundColor: colors.surface, marginHorizontal: spacing.lg, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <ChatRoomsList onOpen={(courseId) => router.push(`/(teacher)/tickets/chat/${courseId}` as Href)} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: chatEnabled ? 0 : -spacing.lg, gap: spacing.md }}>
            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : isError ? (
              <ErrorState onRetry={() => refetch()} />
            ) : !tickets?.length ? (
              <EmptyState icon="tickets" title={t('tickets.empty')} />
            ) : (
              tickets.map((ticket) => {
                const sc = statusColors[ticket.status] || statusColors.open;
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    onPress={() => router.push(`/(teacher)/tickets/${ticket.id}`)}
                    activeOpacity={0.75}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: radius.xl,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: spacing.lg,
                      ...shadows.sm,
                      borderStartWidth: 4,
                      borderStartColor: sc[0],
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, marginEnd: spacing.sm }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, color: colors.textPrimary }} numberOfLines={1}>
                          {ticket.subject}
                        </Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, marginTop: 4 }}>
                          {ticket.student_name}{ticket.parent_name ? ` · ${ticket.parent_name}` : ''}
                        </Text>
                      </View>
                      <StatusBadge status={ticket.status} />
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: priorityColors[ticket.priority] || colors.warning, marginEnd: 6 }} />
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>
                          {t(`tickets.priority_${ticket.priority}`)}
                        </Text>
                      </View>
                      {ticket.message_count != null && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Icon name="ticket" size={14} color={colors.textTertiary} outline style={{ marginEnd: 4 }} />
                          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>
                            {ticket.message_count}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Segment({ label, icon, active, badge, onPress }: {
  label: string;
  icon: 'chat' | 'tickets';
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
