import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useNotificationsFeed, useMarkRead, useMarkUnread, useMarkAllRead, useDismissNotification, useRestoreNotification } from '@/hooks/useNotifications';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useAuthStore } from '@/stores/authStore';
import type { Notification } from '@/api/notifications';
import { notificationRouteFor } from '@/utils/notification-routing';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { timeAgo, formatNumber } from '@/utils/format';
import { notificationCategory, type NotificationCategory } from '@/utils/notificationCategory';

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

type Filter = 'all' | 'unread' | NotificationCategory;
const CATEGORIES: NotificationCategory[] = ['attendance', 'money', 'students', 'followup'];
const HINT_KEY = 'notif_swipe_hint_v1';

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

/** One feed row: swipe toward the end = read / unread, the other way = hide. */
const FeedRow = memo(function FeedRow({
  n, opens, onOpen, onToggleRead, onHide,
}: {
  n: Notification;
  opens: boolean;
  onOpen: (n: Notification) => void;
  onToggleRead: (n: Notification) => void;
  onHide: (n: Notification) => void;
}) {
  const { t } = useTranslation();
  const look = LOOK[n.type] ?? { icon: 'bell' as IconName, tint: colors.brand };
  const unread = !n.is_read;
  return (
    <SwipeRow
      style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.xl }}
      start={{ icon: unread ? 'success' : 'bell', label: t(unread ? 'notifications.swipe_read' : 'notifications.swipe_unread'), color: colors.brand, onTrigger: () => onToggleRead(n) }}
      end={{ icon: 'close', label: t('notifications.swipe_hide'), color: colors.danger, removes: true, onTrigger: () => onHide(n) }}
    >
      <TouchableOpacity
        onPress={() => onOpen(n)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityHint={t('notifications.swipe_a11y')}
        style={{
          flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
          backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1,
          borderColor: unread ? look.tint + '55' : colors.border,
          borderStartWidth: unread ? 5 : 1, borderStartColor: unread ? look.tint : colors.border,
          padding: spacing.lg,
        }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: unread ? look.tint : look.tint + '1A', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name={look.icon} size={22} color={unread ? '#fff' : look.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ flex: 1, fontFamily: unread ? fonts.bold : fonts.medium, fontSize: 15, color: unread ? colors.textPrimary : colors.textSecondary }} numberOfLines={2}>{n.title}</Text>
            {unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: look.tint }} /> : null}
          </View>
          {n.body ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginTop: 3 }} numberOfLines={3}>{n.body}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{timeAgo(n.created_at)}</Text>
            {opens ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('notifications.open')}</Text>
                <Icon name="back" size={14} color={colors.brand} />
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </SwipeRow>
  );
});

/**
 * The notifications feed for every role. A tap marks the row read AND opens what it is
 * about through {@link notificationRouteFor} (the same table the push tap uses). Swipe
 * one way to flip read / unread, the other to hide it (soft — «تراجع» brings it back for a
 * few seconds; the server keeps the row either way). Filters: all · unread · by kind.
 */
export function NotificationsFeed({ can }: { can?: (ability: string) => boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const feed = useNotificationsFeed();
  const { refreshing, onRefresh } = usePullRefresh(feed.refetch);
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const markAllRead = useMarkAllRead();
  const dismiss = useDismissNotification();
  const restore = useRestoreNotification();
  const [filter, setFilter] = useState<Filter>('all');

  // Undo bar after a hide.
  const [undo, setUndo] = useState<Notification | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  // One-time «اسحب…» hint, gone after the first swipe or a tap on ×.
  const [hint, setHint] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(HINT_KEY).then((v) => setHint(v !== '1')).catch(() => {});
  }, []);
  const closeHint = useCallback(() => {
    setHint(false);
    AsyncStorage.setItem(HINT_KEY, '1').catch(() => {});
  }, []);

  const all = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);
  const unreadCount = all.filter((n) => !n.is_read).length;
  const catCounts = useMemo(() => {
    const c: Record<NotificationCategory, number> = { attendance: 0, money: 0, students: 0, followup: 0, other: 0 };
    for (const n of all) c[notificationCategory(n.type)]++;
    return c;
  }, [all]);
  // A kind chip shows only when there is something of that kind.
  const chips: Filter[] = ['all', 'unread', ...CATEGORIES.filter((k) => catCounts[k] > 0)];
  useEffect(() => { if (!chips.includes(filter)) setFilter('all'); }, [chips, filter]);

  const shown = useMemo(() => (
    filter === 'all' ? all
      : filter === 'unread' ? all.filter((n) => !n.is_read)
      : all.filter((n) => notificationCategory(n.type) === filter)
  ), [all, filter]);

  const sections = useMemo(() => {
    const now = new Date();
    const groups: Record<Bucket, Notification[]> = { today: [], yesterday: [], week: [], older: [] };
    for (const n of shown) groups[bucketOf(n.created_at, now)].push(n);
    return (Object.keys(groups) as Bucket[])
      .filter((k) => groups[k].length > 0)
      .map((k) => ({ key: k, title: t(`notifications.group_${k}`), data: groups[k] }));
  }, [shown, t]);

  const onOpen = useCallback((n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id);
    const route = notificationRouteFor({ role, type: n.type, data: n.data, can });
    if (route) router.push(route as never);
  }, [markRead, role, can]);

  const onToggleRead = useCallback((n: Notification) => {
    if (hint) closeHint();
    (n.is_read ? markUnread : markRead).mutate(n.id);
  }, [hint, closeHint, markRead, markUnread]);

  const onHide = useCallback((n: Notification) => {
    if (hint) closeHint();
    dismiss.mutate(n.id);
    setUndo(n);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }, [hint, closeHint, dismiss]);

  const onUndo = () => {
    if (!undo) return;
    restore.mutate(undo.id);
    setUndo(null);
  };

  const chipLabel = (f: Filter) => (f === 'all' || f === 'unread' ? t(`notifications.filter_${f}`) : t(`notifications.cat_${f}`));
  const chipCount = (f: Filter) => (f === 'all' ? 0 : f === 'unread' ? unreadCount : catCounts[f]);

  const Header = (
    <View>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.sm, paddingBottom: spacing.lg, borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="forward" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {unreadCount > 0 ? (
            <TouchableOpacity
              onPress={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md, height: 40, paddingHorizontal: spacing.md }}
            >
              {markAllRead.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="success" size={16} color="#fff" />}
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff' }}>{t('notifications.mark_all_read')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff' }}>{t('notifications.title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              {unreadCount > 0 ? t('notifications.unread_summary', { n: formatNumber(unreadCount) }) : t('notifications.all_read_summary')}
            </Text>
          </View>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: unreadCount > 0 ? colors.accent : 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="bell" size={26} color={unreadCount > 0 ? colors.onAccent : '#fff'} />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          {chips.map((f) => {
            const on = filter === f;
            const n = chipCount(f);
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: on ? '#fff' : 'rgba(255,255,255,0.16)' }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.brand : '#fff' }}>{chipLabel(f)}</Text>
                {n > 0 ? (
                  <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: f === 'unread' ? colors.accent : on ? colors.brandTint : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: f === 'unread' ? colors.onAccent : on ? colors.brand : '#fff' }}>{formatNumber(n)}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {hint && all.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.accentLight }}>
          <Icon name="transfer" size={20} color={colors.onAccent} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.onAccent }}>{t('notifications.swipe_hint')}</Text>
          <TouchableOpacity onPress={closeHint} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Icon name="close" size={16} color={colors.onAccent} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(n) => String(n.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom + 64, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }}
        ListHeaderComponent={Header}
        initialNumToRender={10}
        windowSize={7}
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
        renderItem={({ item }) => (
          <FeedRow
            n={item}
            opens={notificationRouteFor({ role, type: item.type, data: item.data, can }) !== null}
            onOpen={onOpen}
            onToggleRead={onToggleRead}
            onHide={onHide}
          />
        )}
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} /> : <View style={{ height: spacing.lg }} />}
      />

      {undo ? (
        <View style={{ position: 'absolute', start: spacing.lg, end: spacing.lg, bottom: nav.bottomHeight + insets.bottom + spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, ...shadows.md }}>
          <Icon name="close" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: '#fff' }} numberOfLines={1}>{t('notifications.hidden_toast')}</Text>
          <TouchableOpacity onPress={onUndo} hitSlop={10} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accent }}>{t('notifications.undo')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
