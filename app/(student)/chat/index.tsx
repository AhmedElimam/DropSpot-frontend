import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { senderColor } from '@/theme/chat';
import { useChatChannels, useChatEnabled } from '@/hooks/useChat';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatShortDate, formatTime, relativeDay } from '@/utils/format';
import type { ChatChannelSummary } from '@/api/chat';

/**
 * The student's rooms — one per course they are enrolled in, nothing else (membership is the
 * roster, derived server-side), newest activity first.
 *
 * Laid out as a messenger's conversation list on purpose: avatar, name, one preview line,
 * time, unread pill. It is the layout that makes "which room has something new" answerable
 * in one glance rather than one read.
 */
export default function StudentChatList() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const enabled = useChatEnabled();
  const { data: channels, isLoading, refetch } = useChatChannels();
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const list = channels ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.sm,
          backgroundColor: colors.brand,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
            <Icon name="forward" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 21, color: '#fff' }}>{t('chat.title')}</Text>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, color: 'rgba(255,255,255,0.78)', paddingHorizontal: spacing.sm, marginTop: 2 }}>
          {t('chat.subtitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {!enabled ? (
          <EmptyState icon="chat" title={t('common.not_available')} />
        ) : isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />
        ) : list.length === 0 ? (
          <EmptyState icon="chat" title={t('chat.empty_title')} message={t('chat.empty_body')} />
        ) : (
          list.map((c, i) => <Row key={c.course_id} channel={c} last={i === list.length - 1} />)
        )}
      </ScrollView>
    </View>
  );
}

function Row({ channel: c, last }: { channel: ChatChannelSummary; last: boolean }) {
  const { t } = useTranslation();
  const unread = c.unread > 0;
  const name = c.course_name ?? '—';

  // Who said it, then what — the two halves of a messenger preview line.
  const preview = c.last_preview
    ? `${c.last_mine ? t('chat.you') : (c.last_sender ?? '')}: ${c.last_preview}`
    : t('chat.no_preview');

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(student)/chat/${c.course_id}` as Href)}
      activeOpacity={0.6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface }}
    >
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: senderColor(c.course_id), alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: '#fff' }}>{name.trim().charAt(0)}</Text>
      </View>

      <View style={{ flex: 1, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderLight, paddingBottom: spacing.md, marginBottom: -spacing.md, paddingTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16.5, color: colors.textPrimary }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: unread ? colors.success : colors.textTertiary }}>
            {stamp(c.last_message_at)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 }}>
          <Text
            style={{ flex: 1, fontFamily: unread ? fonts.medium : fonts.regular, fontSize: 14, color: unread ? colors.textSecondary : colors.textTertiary }}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {!c.notify ? <Icon name="bellOff" size={14} color={colors.textTertiary} outline /> : null}
          {c.locked ? <Icon name="lock" size={13} color={colors.textTertiary} /> : null}
          {c.announcements_only ? <Icon name="info" size={13} color={colors.textTertiary} outline /> : null}
          {unread ? (
            <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{c.unread > 99 ? '99+' : c.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Time for today, «أمس» for yesterday, a short date beyond — the messenger convention. */
function stamp(iso: string | null): string {
  if (!iso) return '';
  const rel = relativeDay(iso);
  if (rel === 'اليوم') return formatTime(iso);
  if (rel) return rel;
  return formatShortDate(iso);
}
