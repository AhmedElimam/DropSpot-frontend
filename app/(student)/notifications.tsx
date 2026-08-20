import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, layout } from '@/theme/index';
import { useNotifications, useMarkRead, useMarkAllRead } from '@/hooks/useNotifications';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import type { Notification } from '@/api/notifications';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { timeAgo } from '@/utils/format';

const notifIcon: Record<string, IconName> = {
  attendance: 'attendance', absence: 'warning', left_early: 'clock', grade: 'grades',
  invoice: 'invoices', invoice_new: 'invoices', invoice_overdue: 'money',
  session_swap: 'calendar', schedule: 'calendar', student_report: 'note',
  // Teacher tried to reach the parent and got no answer — urgent nudge.
  parent_unreachable: 'call',
};

/**
 * The student notifications feed. The `/notifications` API is role-agnostic, so this
 * mirrors the parent feed; a tap just marks the row read (no parent-only deep links).
 */
export default function StudentNotificationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: notifications, isLoading, refetch } = useNotifications();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const list = notifications ?? [];
  const hasUnread = list.some((n) => !n.is_read);

  function onPressRow(n: Notification) {
    if (!n.is_read) markRead.mutate(n.id);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: insets.top + spacing.md, paddingBottom: layout.tabBottom + insets.bottom, gap: layout.sectionGap }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 23, color: colors.ink, letterSpacing: -0.3 }}>{t('notifications.title')}</Text>
          {hasUnread ? (
            <TouchableOpacity
              onPress={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: spacing.md }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{t('notifications.mark_all_read')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ gap: layout.cardGap }}>
          {isLoading ? (
            <SkeletonList count={5} />
          ) : list.length === 0 ? (
            <EmptyState icon="bell" title={t('notifications.no_notifications')} message={t('notifications.empty')} />
          ) : (
            list.map((n) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => onPressRow(n)}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1,
                  borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, ...shadows.sm,
                  borderStartWidth: 4, borderStartColor: n.is_read ? colors.border : colors.brand,
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name={notifIcon[n.type] || 'bell'} size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{n.title}</Text>
                  {n.body ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: 2 }}>{n.body}</Text>
                  ) : null}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>{timeAgo(n.created_at)}</Text>
                </View>
                {!n.is_read ? (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand, marginTop: 4 }} />
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
