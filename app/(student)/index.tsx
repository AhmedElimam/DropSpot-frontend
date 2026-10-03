import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useTodaySessions } from '@/hooks/useSessions';
import { useCoverageStats, useStudentAttendanceRisk } from '@/hooks/useAttendance';
import { useStudentBillingStatus } from '@/hooks/useInvoices';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useUnreadCount } from '@/hooks/useNotifications';
import { WhatsNewCard } from '@/components/WhatsNewCard';
import { AttendanceRiskCard } from '@/components/attendance/AttendanceRiskCard';
import { BillingOverdueCard } from '@/components/attendance/BillingOverdueCard';
import { CardOrderBanner } from '@/components/cardOrder/CardOrderBanner';
import { formatDate, formatTime, formatNumber } from '@/utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { HeaderBrandBar } from '@/components/ui/HeaderBrandBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SectionHead } from '@/components/ui/SectionHead';
import { ShortcutTile } from '@/components/ui/ShortcutTile';

const statusDot = (): Record<string, string> => ({
  live: colors.success,
  scheduled: colors.warning,
  completed: colors.info,
  cancelled: colors.danger,
});

const FOUR_HOURS = 4 * 60 * 60 * 1000;

type Session = NonNullable<ReturnType<typeof useTodaySessions>['data']>[number];

/**
 * Student home (founder 2026-10-03: «some love on the student side»). Same shape as the
 * teacher home so the family of screens reads as one app: a short hero with the day in
 * three numbers, a SPOTLIGHT on the session that matters now, four coloured shortcuts,
 * then today's list and the month's attendance.
 */
export default function StudentDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useTodaySessions();
  const { data: stats, refetch: refetchStats } = useCoverageStats();
  const { data: risks, refetch: refetchRisks } = useStudentAttendanceRisk();
  const { data: billingAlerts, refetch: refetchBilling } = useStudentBillingStatus();
  const { data: unread } = useUnreadCount();

  const { refreshing, onRefresh } = usePullRefresh(refetchSessions, refetchStats, refetchRisks, refetchBilling);

  const total = stats?.total ?? 0;
  const pct = total > 0 ? Math.round(((stats?.present ?? 0) + (stats?.late ?? 0)) / total * 100) : 0;
  const list = sessions ?? [];
  const now = Date.now();
  // The one session to put first: live, else the next scheduled one the student has not been
  // marked for yet.
  const spotlight = list.find((s) => s.status === 'live')
    ?? list.find((s) => s.status === 'scheduled' && !s.attendance_status && new Date(s.scheduled_at).getTime() >= now);
  const firstName = (user?.name ?? '').split(' ')[0];

  const shortcuts = [
    { key: 'checkin', icon: 'card' as const, label: t('attendance.check_in'), color: colors.brand, tint: colors.brandTint, onPress: () => router.navigate('/(student)/check-in') },
    { key: 'invoices', icon: 'invoices' as const, label: t('nav.invoices'), color: colors.accent, tint: colors.accentLight, onPress: () => router.navigate('/(student)/invoices') },
    { key: 'swap', icon: 'calendar' as const, label: t('swap.entry'), color: colors.success, tint: colors.successLight, onPress: () => router.navigate('/(student)/swap') },
    { key: 'marks', icon: 'reports' as const, label: t('nav.marks'), color: colors.info, tint: colors.infoLight, onPress: () => router.navigate('/(student)/marks') },
  ];

  return (
    // Container painted the hero color so a top overscroll reveals the header tone,
    // not the page background (which looked like an ugly gap).
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl + insets.top, paddingBottom: spacing.xl4 + spacing.xl }}
        >
          <HeaderBrandBar onBell={() => router.navigate('/(student)/notifications' as never)} unread={unread} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.onHero }}>
            {t('common.greeting', { name: firstName })}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.onHeroSoft, marginTop: 2 }}>
            {formatDate(new Date())}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm }}>
            {[
              { k: 'today', v: formatNumber(list.length), l: t('session.today_sessions') },
              { k: 'upcoming', v: formatNumber(list.filter((s) => s.status === 'scheduled').length), l: t('session.upcoming_sessions') },
              { k: 'absent', v: formatNumber(stats?.absent ?? 0), l: t('attendance.absent'), warn: (stats?.absent ?? 0) > 0 },
            ].map((x) => (
              <View key={x.k} style={{ flex: 1, backgroundColor: colors.onHeroChip, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.onHeroChipBorder, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: x.warn ? colors.accent : colors.onHero }}>{x.v}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.onHeroSoft }} numberOfLines={1}>{x.l}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
          {/* Spotlight — the session that matters now, or a calm card when the day is done. */}
          {sessionsLoading ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', ...shadows.md }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : spotlight ? (
            <Spotlight s={spotlight} now={now} />
          ) : (
            <TouchableOpacity onPress={() => router.navigate('/(student)/check-in')} activeOpacity={0.9}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.md }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="calendar" size={26} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('session.no_sessions')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{t('nav.check_in')}</Text>
              </View>
              <Icon name="back" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            <CardOrderBanner scope="student" />
            <WhatsNewCard />
            {(billingAlerts ?? []).map((alert, i) => (
              <BillingOverdueCard key={`bill-${alert.student_id}-${i}`} alert={alert} />
            ))}
            {(risks ?? []).map((risk, i) => (
              <AttendanceRiskCard key={`${risk.student_id}-${risk.course_name ?? i}`} risk={risk} />
            ))}
          </View>

          {/* Shortcuts — four coloured, labelled buttons. */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg }}>
            {shortcuts.map((x) => <ShortcutTile key={x.key} icon={x.icon} label={x.label} color={x.color} tint={x.tint} onPress={x.onPress} />)}
          </View>

          {/* Today */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHead icon="sessions" color={colors.brand} title={t('session.today_sessions')} action={t('common.view_all')} onAction={() => router.navigate('/(student)/check-in')} />
            {sessionsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
            ) : list.length === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={[textPresets.bodySmall, { color: colors.textTertiary }]}>{t('session.no_sessions')}</Text>
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {list.map((session) => <SessionRow key={session.id} session={session} now={now} />)}
              </View>
            )}
          </View>

          {/* Attendance this month */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHead icon="attendance" color={colors.success} title={t('home.attendance_overview')} />
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
                  <LinearGradient colors={gradients.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${pct}%`, height: '100%', borderRadius: 5 }} />
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.successText }}>{formatNumber(pct)}%</Text>
              </View>
              <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm }}>
                {[
                  { v: stats?.present ?? 0, l: t('attendance.present'), bg: colors.successLight, fg: colors.successText },
                  { v: stats?.excused ?? 0, l: t('attendance.excused'), bg: colors.infoLight, fg: colors.infoText },
                  { v: stats?.absent ?? 0, l: t('attendance.absent'), bg: colors.dangerLight, fg: colors.dangerText },
                ].map((x) => (
                  <View key={x.l} style={{ flex: 1, alignItems: 'center', backgroundColor: x.bg, borderRadius: radius.md, paddingVertical: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: x.fg }}>{formatNumber(x.v)}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: x.fg, marginTop: 2 }}>{x.l}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** The session that matters now, on the brand gradient: live, or the next one. */
function Spotlight({ s, now }: { s: Session; now: number }) {
  const { t } = useTranslation();
  const start = new Date(s.scheduled_at);
  const end = new Date(start.getTime() + s.duration_minutes * 60000);
  const live = s.status === 'live';
  const soon = !live && start.getTime() - now <= FOUR_HOURS;
  return (
    <TouchableOpacity onPress={() => router.navigate('/(student)/check-in')} activeOpacity={0.9} accessibilityRole="button" style={{ borderRadius: radius.xxl, overflow: 'hidden', ...shadows.md }}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {live ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} /> : null}
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
            {live ? t('home.live_session') : t('home.next_session')}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: '#fff', marginTop: 4 }} numberOfLines={1}>{s.course_name}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }} numberOfLines={1}>
          {t('home.spotlight_sub', { teacher: s.teacher_name, place: s.location })}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: spacing.md }}>
            <Icon name="clock" size={14} color="#fff" outline />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff' }}>{formatTime(start)} - {formatTime(end)}</Text>
          </View>
          {live || soon ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: spacing.lg }}>
              <Icon name="card" size={16} color={colors.primaryDark} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primaryDark }}>{t('attendance.check_in')}</Text>
            </View>
          ) : <Icon name="back" size={18} color="rgba(255,255,255,0.8)" />}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SessionRow({ session, now }: { session: Session; now: number }) {
  const { t } = useTranslation();
  const start = new Date(session.scheduled_at);
  const end = new Date(start.getTime() + session.duration_minutes * 60000);
  // "Starting soon" = scheduled and within 4 hours of the start time.
  const msToStart = start.getTime() - now;
  const startingSoon = session.status === 'scheduled' && !session.attendance_status && msToStart > 0 && msToStart <= FOUR_HOURS;
  const accent = startingSoon ? colors.brand : (statusDot()[session.status] || colors.border);
  return (
    <TouchableOpacity
      onPress={() => router.navigate('/(student)/check-in')}
      activeOpacity={0.75}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}
    >
      <View style={{ width: 58, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: `${accent}1F` }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: accent }}>{formatTime(start)}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{formatTime(end)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{session.course_name}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {session.teacher_name} · {session.location}
        </Text>
      </View>
      {/* Prefer the student's OWN outcome once recorded; a "starting soon" chip flags the
          next 4h window; else fall back to the session lifecycle. */}
      {startingSoon ? (
        <View style={{ backgroundColor: colors.brandTint, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('attendance.starting_soon')}</Text>
        </View>
      ) : (
        <StatusBadge status={session.attendance_status ?? session.status} size="sm" />
      )}
    </TouchableOpacity>
  );
}
