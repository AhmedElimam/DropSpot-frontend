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
import { Icon, type IconName } from '@/components/ui/Icon';
import { HeaderBrandBar } from '@/components/ui/HeaderBrandBar';
import { TeacherSwitcher } from '@/components/teacher/TeacherSwitcher';
import { PendingInvitations } from '@/components/teacher/PendingInvitations';
import { HubRow } from '@/components/teacher/HubRow';
import { AddStudentSheet } from '@/components/teacher/AddStudentSheet';
import { SessionCard, sessionPhase, type SessionCardData } from '@/components/session/TeacherSessionCard';
import { AttendanceRing } from '@/components/session/AttendanceVisuals';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getCashReconciliation } from '@/api/cash';
import { getBookingRequests } from '@/api/bookingRequests';
import { getAssistantActions } from '@/api/assistantActions';
import { usePhoneConfirmations } from '@/hooks/usePhoneConfirmations';
import { useTickets } from '@/hooks/useTickets';
import { formatNumber, formatDayDate } from '@/utils/format';
import { pickCurrentSession, goToScan } from '@/utils/sessionNav';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { useRose } from '@/hooks/useRose';

function greetingKey(now: number): string {
  const h = new Date(now).getHours();
  return h < 12 ? 'home.good_morning' : 'home.good_evening';
}

/**
 * Home (founder 2026-10-02, second pass: "i don't like the new homepage"). Warm, coloured
 * and about TODAY: an ink hero with today's numbers, a coloured spotlight for the session
 * that matters now (green while live, indigo while waiting, with a countdown), four big
 * coloured shortcuts, what needs you, then the rest of the day as a timetable.
 */
export default function TeacherHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: unread } = useUnreadCount();
  const { can, isAssistant } = useActiveAbilities();
  const canCash = can(ABILITY.SCAN);
  const canStudents = can(ABILITY.MANAGE_STUDENTS);
  const now = useMinuteClock();
  const rose = useRose();

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

  const sessions = sessionsQ.data ?? [];
  const current = pickCurrentSession(sessions, now);
  const rest = sessions.filter((s) => s.id !== current?.id);
  const presentToday = sessions.reduce((n, s) => n + (s.checked_in_count ?? 0), 0);
  const rosterToday = sessions.reduce((n, s) => n + (s.enrolled_count ?? 0), 0);
  const openSheet = (s: { id: string }) => router.push(`/(teacher)/sessions/${s.id}` as Href);
  const scan = (s: SessionCardData) => goToScan(s as TeacherSession);

  const attention = [
    offlineAttention > 0 && { key: 'sync', icon: 'warning' as IconName, title: pending > 0 ? t('teacher.pending_scans', { count: pending }) : t('teacher.rejected_title', { count: rejected }), sub: t('teacher.tap_to_reconcile'), badge: offlineAttention, href: '/(teacher)/reconcile' },
    (phonesQ.data?.count ?? 0) > 0 && { key: 'phones', icon: 'phone' as IconName, title: t('home.phones_title'), sub: t('home.phones_sub', { count: phonesQ.data?.count ?? 0 }), badge: phonesQ.data?.count ?? 0, href: '/(teacher)/phone-confirmations' },
    (bookingQ.data?.length ?? 0) > 0 && { key: 'booking', icon: 'bell' as IconName, title: t('booking_requests.title'), sub: t('booking_requests.manage_sub'), badge: bookingQ.data?.length ?? 0, href: '/(teacher)/booking-requests' },
    cashAttention > 0 && { key: 'cash', icon: 'money' as IconName, title: cashPending ? t('cash.banner_pending', { rose: rose.name }) : rose.title, sub: cashPending ? t('cash.banner_pending_sub', { amount: formatNumber(cashPending.collected, { maximumFractionDigits: 0 }) }) : t('home.cash_attention_sub'), badge: cashAttention, href: '/(teacher)/cash-reconcile' },
    (actionsQ.data?.length ?? 0) > 0 && { key: 'actions', icon: 'eye' as IconName, title: t('assistant_actions.title'), sub: t('assistant_actions.manage_sub'), badge: actionsQ.data?.length ?? 0, href: '/(teacher)/assistant-actions' },
    openTickets > 0 && { key: 'tickets', icon: 'tickets' as IconName, title: t('home.tickets_title'), sub: t('home.tickets_sub'), badge: openTickets, href: '/(teacher)/tickets' },
  ].filter(Boolean) as { key: string; icon: IconName; title: string; sub: string; badge: number; href: string }[];
  const attentionTotal = attention.reduce((n, a) => n + a.badge, 0);

  const shortcuts: { key: string; icon: IconName; label: string; color: string; tint: string; badge?: number; onPress: () => void }[] = [
    canStudents && { key: 'add', icon: 'add' as IconName, label: t('add_student.title'), color: colors.brand, tint: colors.brandTint, onPress: () => setAddOpen(true) },
    canCash && { key: 'collect', icon: 'money' as IconName, label: t('home.collect'), color: colors.success, tint: colors.successLight, onPress: () => router.push('/(teacher)/collect' as Href) },
    canCash && { key: 'rose', icon: 'note' as IconName, label: rose.name, color: colors.accent, tint: colors.accentLight, badge: cashAttention, onPress: () => router.push('/(teacher)/cash-reconcile' as Href) },
    !isAssistant
      ? { key: 'insights', icon: 'reports' as IconName, label: t('home.insights_short'), color: colors.info, tint: colors.infoLight, onPress: () => router.push('/(teacher)/insights' as Href) }
      : { key: 'students', icon: 'children' as IconName, label: t('teacher.tab_students'), color: colors.info, tint: colors.infoLight, onPress: () => router.push('/(teacher)/students' as Href) },
  ].filter(Boolean) as never;

  const firstName = (user?.name ?? '').split(' ')[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero — greeting and today in three numbers. */}
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl4 + spacing.xl }}>
          <HeaderBrandBar
            onBell={() => router.push('/(teacher)/notifications' as Href)}
            unread={unread}
            onScan={canCash ? () => router.push('/(teacher)/scan' as Href) : undefined}
            scanBadge={offlineAttention}
          />
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{`${t(greetingKey(now))}، ${firstName}`}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{formatDayDate(new Date(now))}</Text>
          <TeacherSwitcher />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            {[
              { k: 'sessions', v: formatNumber(sessions.length), l: t('home.stat_sessions') },
              { k: 'present', v: rosterToday > 0 ? `${formatNumber(presentToday)}/${formatNumber(rosterToday)}` : formatNumber(presentToday), l: t('home.stat_present') },
              { k: 'attention', v: formatNumber(attentionTotal), l: t('home.stat_attention') },
            ].map((x) => (
              <View key={x.k} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: x.k === 'attention' && attentionTotal > 0 ? colors.accent : '#fff' }}>{x.v}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.72)' }} numberOfLines={1}>{x.l}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
          {/* Spotlight — the session that matters now. */}
          {sessionsQ.isLoading ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', ...shadows.md }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : current ? (
            <Spotlight s={current} now={now} canScan={canCash} onScan={scan} onOpen={openSheet} />
          ) : (
            <TouchableOpacity onPress={() => router.push('/(teacher)/sessions' as Href)} activeOpacity={0.9}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.md }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="calendar" size={26} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{sessions.length ? t('home.day_done') : t('teacher.no_sessions_today')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{t('home.see_week')}</Text>
              </View>
              <Icon name="back" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          <PendingInvitations />

          {/* Shortcuts — four coloured, labelled buttons. */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg }}>
            {shortcuts.map((x) => (
              <TouchableOpacity key={x.key} onPress={x.onPress} activeOpacity={0.85} accessibilityRole="button" style={{ width: '24%', alignItems: 'center' }}>
                <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: x.tint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={x.icon} size={26} color={x.color} />
                  {x.badge ? (
                    <View style={{ position: 'absolute', top: -4, end: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{x.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary, marginTop: 6, textAlign: 'center' }} numberOfLines={1}>{x.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {attention.length > 0 ? (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHead icon="warning" color={colors.warning} title={t('home.needs_you')} />
              {attention.map((a) => <HubRow key={a.key} icon={a.icon} title={a.title} sub={a.sub} badge={a.badge} onPress={() => router.push(a.href as Href)} />)}
            </View>
          ) : null}

          {rest.length > 0 ? (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHead icon="calendar" color={colors.brand} title={t('home.rest_of_day')} action={t('home.all_sessions')} onAction={() => router.push('/(teacher)/sessions' as Href)} />
              {rest.map((s) => <SessionCard key={s.id} s={s} now={now} onOpen={openSheet} compact />)}
            </View>
          ) : null}

          <View style={{ marginTop: spacing.xl }}><WhatsNewCard /></View>
        </View>
      </ScrollView>
      <AddStudentSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

function SectionHead({ icon, color, title, action, onAction }: { icon: IconName; color: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: color + '1F', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={15} color={color} />
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{title}</Text>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Green while live (ring fills as students arrive), indigo with a countdown before. */
function Spotlight({ s, now, canScan, onScan, onOpen }: { s: TeacherSession; now: number; canScan: boolean; onScan: (s: SessionCardData) => void; onOpen: (s: { id: string }) => void }) {
  const { t } = useTranslation();
  const live = sessionPhase(s, now) === 'live';
  const startsIn = s.scheduled_at ? Math.max(0, Math.round((new Date(s.scheduled_at).getTime() - now) / 60_000)) : null;
  const total = s.enrolled_count ?? 0;
  const present = s.checked_in_count ?? 0;
  return (
    <LinearGradient colors={live ? gradients.success : gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius.xxl, padding: spacing.lg, ...shadows.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {live ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} /> : null}
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
              {live ? t('teacher.live_now') : startsIn !== null && startsIn <= 180 ? t('home.starts_in', { n: formatNumber(startsIn) }) : t('home.next_session')}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginTop: 4 }} numberOfLines={1}>{s.course_name ?? '—'}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 }} numberOfLines={1}>
            {s.time ?? ''}{s.location ? ` · ${s.location}` : ''}
          </Text>
          {s.cycle_position ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 9, marginTop: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t('teacher.position_of', { n: formatNumber(s.cycle_position.n), of: formatNumber(s.cycle_position.of) })}</Text>
            </View>
          ) : null}
        </View>
        {total > 0 ? <AttendanceRing present={present} total={total} onDark /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        {canScan ? (
          <TouchableOpacity onPress={() => onScan(s)} activeOpacity={0.85} accessibilityRole="button"
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: radius.lg, backgroundColor: '#fff' }}>
            <Icon name="scan" size={20} color={live ? colors.success : colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: live ? colors.successText : colors.brand }}>{t('sessions_tab.scan')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => onOpen(s)} activeOpacity={0.85} accessibilityRole="button"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: radius.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' }}>
          <Icon name="attendance" size={20} color="#fff" outline />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('sessions_tab.sheet')}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}
