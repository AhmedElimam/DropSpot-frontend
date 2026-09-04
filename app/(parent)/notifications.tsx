import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useNotifications, useMarkRead, useMarkAllRead } from '@/hooks/useNotifications';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import type { Notification } from '@/api/notifications';
import { notificationRoute } from '@/utils/notification-routing';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { timeAgo } from '@/utils/format';

const notifIcon: Record<string, IconName> = {
  attendance: 'attendance', absence: 'warning', left_early: 'clock', grade: 'grades',
  invoice: 'invoices', invoice_new: 'invoices', invoice_overdue: 'money',
  session_swap: 'calendar', enrollment_transfer: 'calendar', schedule: 'calendar',
  student_report: 'note', monthly_report: 'reports', daily_digest: 'bell',
  student_linked: 'child',
  sibling_claim: 'warning',
};

/**
 * The parent notifications feed (§4). Wires the notifications API that already
 * existed but had no screen — the daily digest and every other push now have a
 * durable home here, not just the single latest tile on Home. Tapping a row marks
 * it read and deep-links by type via {@link notificationRoute}.
 */
export default function NotificationsScreen() {
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
    const route = notificationRoute(n.type, n.data);
    if (route && route !== '/(parent)/notifications') {
      router.push(route as never);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.xl }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Icon name="forward" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.8)', marginStart: spacing.sm }}>{t('common.back')}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff' }}>{t('notifications.title')}</Text>
            {hasUnread ? (
              <TouchableOpacity
                onPress={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: spacing.md }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff' }}>{t('notifications.mark_all_read')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />
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
