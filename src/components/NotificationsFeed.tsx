import { useMemo, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useNotificationsFeed, useMarkRead, useMarkAllRead } from '@/hooks/useNotifications';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useAuthStore } from '@/stores/authStore';
import type { Notification } from '@/api/notifications';
import { notificationRouteFor } from '@/utils/notification-routing';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo } from '@/utils/format';

/** Icon + tint by type, so a glance tells money from attendance from مدام روز. */
const LOOK: Record<string, { icon: IconName; tint: string }> = {
  attendance: { icon: 'attendance', tint: colors.success },
  absence: { icon: 'warning', tint: colors.danger },
  left_early: { icon: 'clock', tint: colors.warning },
  grade: { icon: 'grades', tint: colors.brand },
  special_session: { icon: 'quiz', tint: colors.brand },
  invoice: { icon: 'invoices', tint: colors.brand },
  invoice_new: { icon: 'invoices', tint: colors.brand },
  invoice_overdue: { icon: 'money', tint: colors.danger },
  payment_received: { icon: 'money', tint: colors.success },
  payment_proof_submitted: { icon: 'money', tint: colors.warning },
  payment_proof: { icon: 'money', tint: colors.warning },
  payment_proof_approved: { icon: 'success', tint: colors.success },
  payment_proof_rejected: { icon: 'error', tint: colors.danger },
  billing_override_granted: { icon: 'clock', tint: colors.brand },
  billing_override_granted_by_assistant: { icon: 'clock', tint: colors.warning },
  session_swap: { icon: 'calendar', tint: colors.brand },
  enrollment_transfer: { icon: 'transfer', tint: colors.brand },
  enrollment_approved: { icon: 'success', tint: colors.success },
  student_termination: { icon: 'warning', tint: colors.danger },
  schedule: { icon: 'calendar', tint: colors.brand },
  student_report: { icon: 'note', tint: colors.brand },
  student_report_safety: { icon: 'warning', tint: colors.danger },
  monthly_report: { icon: 'reports', tint: colors.brand },
  daily_digest: { icon: 'bell', tint: colors.brand },
  student_linked: { icon: 'child', tint: colors.success },
  sibling_claim: { icon: 'warning', tint: colors.warning },
  parent_unreachable: { icon: 'call', tint: colors.danger },
  card_issued: { icon: 'card', tint: colors.success },
  card_handover: { icon: 'card', tint: colors.success },
  card_preparing: { icon: 'card', tint: colors.brand },
  card_released: { icon: 'card', tint: colors.success },
  card_order_delivered: { icon: 'card', tint: colors.brand },
  precard_invitation: { icon: 'card', tint: colors.brand },
  invitation_accepted: { icon: 'success', tint: colors.success },
  booking_request: { icon: 'add', tint: colors.brand },
  booking_request_result: { icon: 'success', tint: colors.success },
  ticket_reply: { icon: 'tickets', tint: colors.brand },
  admin_ticket: { icon: 'note', tint: colors.brand },
  admin_ticket_reply: { icon: 'note', tint: colors.brand },
  admin_ticket_resolved: { icon: 'success', tint: colors.success },
  admin_ticket_waiting: { icon: 'clock', tint: colors.warning },
  admin_ticket_progress: { icon: 'refresh', tint: colors.brand },
  cash_review: { icon: 'note', tint: colors.warning },
  cash_gap: { icon: 'warning', tint: colors.danger },
  cash_handover: { icon: 'transfer', tint: colors.brand },
  cash_reconciliation: { icon: 'money', tint: colors.brand },
  cash_insight: { icon: 'star', tint: colors.brand },
  expense_reminder: { icon: 'money', tint: colors.brand },
  financial_report: { icon: 'reports', tint: colors.brand },
  assistant_course_created: { icon: 'book', tint: colors.warning },
  assistant_schedule_created: { icon: 'calendar', tint: colors.warning },
  assistant_session_created: { icon: 'calendar', tint: colors.warning },
  assistant_checkin_review: { icon: 'attendance', tint: colors.warning },
  assistant_action_review: { icon: 'money', tint: colors.warning },
  assistant_report_review: { icon: 'note', tint: colors.warning },
  assistant_action_rejected: { icon: 'error', tint: colors.danger },
  assistant_report_approved: { icon: 'success', tint: colors.success },
  assistant_report_rejected: { icon: 'error', tint: colors.danger },
  assistant_removed: { icon: 'lock', tint: colors.danger },
  student_edit_request_family: { icon: 'profile', tint: colors.brand },
  student_edit_result: { icon: 'profile', tint: colors.brand },
  guardian_disputed: { icon: 'phone', tint: colors.danger },
  parent_number_approved: { icon: 'phone', tint: colors.success },
  device_pending_scans: { icon: 'refresh', tint: colors.warning },
  subscription_expired: { icon: 'warning', tint: colors.danger },
  graduation_notice: { icon: 'trophy', tint: colors.success },
  discrepancy_resolved: { icon: 'success', tint: colors.success },
  excuse_resolved: { icon: 'success', tint: colors.success },
};

type Filter = 'all' | 'unread';
type Bucket = 'today' | 'yesterday' | 'week' | 'older';

function bucketOf(iso: string, now: Date): Bucket {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return 'today';
  if (t >= startOfToday - 86_400_000) return 'yesterday';
  if (t >= startOfToday - 6 * 86_400_000) return 'week';
  return 'older';
}

/**
 * The notifications feed for every role. A tap marks the row read AND opens what it is
 * about (the ticket, the student, the expense thread, the invoices…) through
 * {@link notificationRouteFor}, the same table the push tap uses. Rows are grouped by day,
 * the unread ones can be shown alone, and older pages load as you scroll.
 */
export function NotificationsFeed({ can }: { can?: (ability: string) => boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const feed = useNotificationsFeed();
  const { refreshing, onRefresh } = usePullRefresh(feed.refetch);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const [filter, setFilter] = useState<Filter>('all');

  const all = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);
  const unreadCount = all.filter((n) => !n.is_read).length;
  const shown = filter === 'unread' ? all.filter((n) => !n.is_read) : all;

  const sections = useMemo(() => {
    const now = new Date();
    const groups: Record<Bucket, Notification[]> = { today: [], yesterday: [], week: [], older: [] };
    for (const n of shown) groups[bucketOf(n.created_at, now)].push(n);
    return (Object.keys(groups) as Bucket[])
      .filter((k) => groups[k].length > 0)
      .map((k) => ({ key: k, title: t(`notifications.group_${k}`), data: groups[k] }));
  }, [shown, t]);

  const onPressRow = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id);
    const route = notificationRouteFor({ role, type: n.type, data: n.data, can });
    if (route) router.push(route as never);
  };

  const Header = (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.lg }}
    >
      <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
        <Icon name="forward" size={22} color="rgba(255,255,255,0.8)" />
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.8)', marginStart: spacing.sm }}>{t('common.back')}</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff' }}>{t('notifications.title')}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: spacing.md }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff' }}>{t('notifications.mark_all_read')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {/* الكل / غير المقروء */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        {(['all', 'unread'] as Filter[]).map((f) => {
          const on = filter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.14)' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.brand : '#fff' }}>{t(`notifications.filter_${f}`)}</Text>
              {f === 'unread' && unreadCount > 0 ? (
                <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: on ? colors.brand : 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </LinearGradient>
  );

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <SectionList
        sections={sections}
        keyExtractor={(n) => String(n.id)}
        stickySectionHeadersEnabled={false}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          feed.isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />
          ) : (
            <View style={{ padding: spacing.lg }}>
              <EmptyState
                icon="bell"
                title={filter === 'unread' ? t('notifications.no_unread') : t('notifications.no_notifications')}
                message={filter === 'unread' ? t('notifications.no_unread_hint') : t('notifications.empty')}
              />
            </View>
          )
        }
        renderSectionHeader={({ section }) => (
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>{section.title}</Text>
        )}
        renderItem={({ item: n }) => {
          const look = LOOK[n.type] ?? { icon: 'bell' as IconName, tint: colors.brand };
          const opens = notificationRouteFor({ role, type: n.type, data: n.data, can }) !== null;
          return (
            <TouchableOpacity
              onPress={() => onPressRow(n)}
              activeOpacity={0.75}
              accessibilityRole="button"
              style={{
                flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginHorizontal: spacing.lg, marginBottom: spacing.sm,
                backgroundColor: n.is_read ? colors.surface : colors.brandTint, borderWidth: 1,
                borderColor: n.is_read ? colors.border : colors.brand + '55', borderRadius: radius.xl, padding: spacing.lg, ...shadows.sm,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: look.tint + '1A', justifyContent: 'center', alignItems: 'center' }}>
                <Icon name={look.icon} size={20} color={look.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: n.is_read ? fonts.medium : fonts.bold, fontSize: 15, color: colors.textPrimary }}>{n.title}</Text>
                {n.body ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: 2 }}>{n.body}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{timeAgo(n.created_at)}</Text>
                  {opens ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('notifications.open')}</Text>
                      <Icon name="back" size={14} color={colors.brand} />
                    </View>
                  ) : null}
                </View>
              </View>
              {!n.is_read ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand, marginTop: 4 }} /> : null}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} /> : <View style={{ height: spacing.lg }} />}
      />
    </View>
  );
}
