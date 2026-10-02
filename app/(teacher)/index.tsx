import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadCount } from '@/hooks/useNotifications';
import { WhatsNewCard } from '@/components/WhatsNewCard';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import type { TeacherSession } from '@/api/teacher';
import { useOfflineStore } from '@/stores/offlineStore';
import { Icon } from '@/components/ui/Icon';
import { HeaderBrandBar } from '@/components/ui/HeaderBrandBar';
import { TeacherSwitcher } from '@/components/teacher/TeacherSwitcher';
import { PendingInvitations } from '@/components/teacher/PendingInvitations';
import { HubRow, HubTile } from '@/components/teacher/HubRow';
import { AddStudentSheet } from '@/components/teacher/AddStudentSheet';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getCashReconciliation } from '@/api/cash';
import { getBookingRequests } from '@/api/bookingRequests';
import { getAssistantActions } from '@/api/assistantActions';
import { usePhoneConfirmations } from '@/hooks/usePhoneConfirmations';
import { useTickets } from '@/hooks/useTickets';
import { formatNumber } from '@/utils/format';
import { isSessionHighlighted, pickCurrentSession, goToScan } from '@/utils/sessionNav';

/**
 * Home (founder 2026-10-02: "too much, not simple, hard to navigate"). Three things, in
 * this order: what is happening NOW (the live or next session with its two actions), what
 * NEEDS YOU (one list, only rows with a count), and the four things you reach for most.
 * Everything else lives under الحصص, الطلاب and الإدارة.
 */
export default function TeacherHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: unread } = useUnreadCount();
  const { can, isAssistant } = useActiveAbilities();
  const canCash = can(ABILITY.SCAN);
  const canStudents = can(ABILITY.MANAGE_STUDENTS);

  const sessionsQ = useTeacherTodaySessions();
  const pending = useOfflineStore((s) => s.pending);
  const rejected = useOfflineStore((s) => s.rejected);
  const offlineAttention = pending + rejected;

  const cashQ = useQuery({ queryKey: ['cash-reconciliation'], queryFn: () => getCashReconciliation(), enabled: canCash });
  const cashView = cashQ.data;
  const cashPending = cashView?.role === 'assistant' ? cashView.unanswered[0] ?? null : null;
  const cashAttention = cashView?.role === 'assistant'
    ? cashView.unanswered.length
    : cashView?.role === 'teacher' ? cashView.open_gaps.length + cashView.pending_handovers.length : 0;
  const bookingQ = useQuery({ queryKey: ['booking-requests'], queryFn: getBookingRequests, enabled: canStudents });
  const actionsQ = useQuery({ queryKey: ['assistant-actions'], queryFn: getAssistantActions, enabled: !isAssistant });
  const phonesQ = usePhoneConfirmations();
  const ticketsQ = useTickets();
  const openTickets = (ticketsQ.data ?? []).filter((x) => x.status === 'open').length;

  const { refreshing, onRefresh } = usePullRefresh(sessionsQ.refetch, phonesQ.refetch, cashQ.refetch, bookingQ.refetch, actionsQ.refetch, ticketsQ.refetch);
  const [addOpen, setAddOpen] = useState(false);

  const now = Date.now();
  const sessions = sessionsQ.data ?? [];
  const current = pickCurrentSession(sessions, now);
  const others = sessions.filter((s) => s.id !== current?.id);
  const openSheet = (s: TeacherSession) => router.push(`/(teacher)/sessions/${s.id}` as Href);

  const attention = [
    offlineAttention > 0 && { key: 'sync', icon: 'warning' as const, title: pending > 0 ? t('teacher.pending_scans', { count: pending }) : t('teacher.rejected_title', { count: rejected }), sub: t('teacher.tap_to_reconcile'), badge: offlineAttention, href: '/(teacher)/reconcile' },
    (phonesQ.data?.count ?? 0) > 0 && { key: 'phones', icon: 'phone' as const, title: t('home.phones_title'), sub: t('home.phones_sub', { count: phonesQ.data?.count ?? 0 }), badge: phonesQ.data?.count ?? 0, href: '/(teacher)/phone-confirmations' },
    (bookingQ.data?.length ?? 0) > 0 && { key: 'booking', icon: 'bell' as const, title: t('booking_requests.title'), sub: t('booking_requests.manage_sub'), badge: bookingQ.data?.length ?? 0, href: '/(teacher)/booking-requests' },
    cashAttention > 0 && { key: 'cash', icon: 'money' as const, title: cashPending ? t('cash.banner_pending') : t('cash.title'), sub: cashPending ? t('cash.banner_pending_sub', { amount: formatNumber(cashPending.collected, { maximumFractionDigits: 0 }) }) : t('home.cash_attention_sub'), badge: cashAttention, href: '/(teacher)/cash-reconcile' },
    (actionsQ.data?.length ?? 0) > 0 && { key: 'actions', icon: 'eye' as const, title: t('assistant_actions.title'), sub: t('assistant_actions.manage_sub'), badge: actionsQ.data?.length ?? 0, href: '/(teacher)/assistant-actions' },
    openTickets > 0 && { key: 'tickets', icon: 'tickets' as const, title: t('home.tickets_title'), sub: t('home.tickets_sub'), badge: openTickets, href: '/(teacher)/tickets' },
  ].filter(Boolean) as { key: string; icon: 'warning' | 'phone' | 'bell' | 'money' | 'eye' | 'tickets'; title: string; sub: string; badge: number; href: string }[];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl }}>
          <HeaderBrandBar
            onBell={() => router.push('/(teacher)/notifications' as Href)}
            unread={unread}
            onScan={canCash ? () => router.push('/(teacher)/scan' as Href) : undefined}
            scanBadge={offlineAttention}
          />
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{t('teacher.today')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginTop: 2 }}>{user?.name ?? ''}</Text>
          <TeacherSwitcher />
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <PendingInvitations />

          {/* 1. NOW — the live or next session, with the two things to do with it. */}
          {sessionsQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : current ? (
            <View style={{ backgroundColor: isSessionHighlighted(current, now) ? colors.successLight : colors.surface, borderRadius: radius.xl, borderWidth: 1.5, borderColor: isSessionHighlighted(current, now) ? colors.success : colors.border, padding: spacing.lg, ...shadows.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: isSessionHighlighted(current, now) ? colors.successText : colors.textTertiary }}>
                  {isSessionHighlighted(current, now) ? t('teacher.live_now') : t('home.next_session')}
                </Text>
                {current.cycle_position ? (
                  <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 8 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('teacher.position_of', { n: current.cycle_position.n, of: current.cycle_position.of })}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, marginTop: 4 }} numberOfLines={1}>{current.course_name ?? '—'}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
                {current.time ?? ''}{current.location ? ` · ${current.location}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                {canCash ? (
                  <TouchableOpacity onPress={() => goToScan(current)} activeOpacity={0.85} accessibilityRole="button"
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: radius.lg, backgroundColor: isSessionHighlighted(current, now) ? colors.success : colors.brand }}>
                    <Icon name="scan" size={20} color="#fff" />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('sessions_tab.scan')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => openSheet(current)} activeOpacity={0.85} accessibilityRole="button"
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: colors.surface }}>
                  <Icon name="attendance" size={20} color={colors.brand} outline />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brand }}>{t('sessions_tab.sheet')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => router.push('/(teacher)/sessions' as Href)} activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
              <Icon name="calendar" size={22} color={colors.textTertiary} outline />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('teacher.no_sessions_today')}</Text>
              <Icon name="back" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          {/* The rest of today, compact; the full list is the الحصص tab. */}
          {others.length > 0 ? (
            <View style={{ marginTop: spacing.sm }}>
              {others.map((s) => (
                <TouchableOpacity key={s.id} onPress={() => (canCash ? goToScan(s) : openSheet(s))} activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginTop: spacing.xs }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, minWidth: 54 }}>{s.time ?? ''}</Text>
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{s.course_name ?? '—'}</Text>
                  <Icon name="back" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => router.push('/(teacher)/sessions' as Href)} style={{ alignSelf: 'flex-start', paddingVertical: spacing.sm }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('home.all_sessions')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* 2. NEEDS YOU — one list, only what has a count. Nothing pending → nothing shown. */}
          {attention.length > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('home.needs_you')}</Text>
              {attention.map((a) => (
                <HubRow key={a.key} icon={a.icon} title={a.title} sub={a.sub} badge={a.badge} onPress={() => router.push(a.href as Href)} />
              ))}
            </View>
          ) : null}

          {/* 3. The four things reached for most — gated, so an assistant sees only theirs. */}
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('home.quick')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {canStudents ? <HubTile icon="add" title={t('add_student.title')} onPress={() => setAddOpen(true)} /> : null}
            {canCash ? <HubTile icon="money" title={t('home.collect')} tint={colors.success} onPress={() => router.push('/(teacher)/collect' as Href)} /> : null}
            {canCash ? <HubTile icon="note" title={t('cash.title_short')} tint={colors.success} badge={cashAttention} onPress={() => router.push('/(teacher)/cash-reconcile' as Href)} /> : null}
            {!isAssistant ? <HubTile icon="reports" title={t('teacher.insights_title')} onPress={() => router.push('/(teacher)/insights' as Href)} /> : null}
            <HubTile icon="children" title={t('teacher.tab_students')} onPress={() => router.push('/(teacher)/students' as Href)} />
          </View>

          <View style={{ marginTop: spacing.lg }}><WhatsNewCard /></View>
        </View>
      </ScrollView>
      <AddStudentSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}
