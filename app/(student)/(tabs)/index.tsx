import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { onWhite } from '@/theme/onWhite';
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
import { TourTarget } from '@/tour/TourTarget';
import { useTourScroll } from '@/tour/useTourScroll';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SectionHead } from '@/components/ui/SectionHead';
import { ShortcutTile } from '@/components/ui/ShortcutTile';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { PercentRing } from '@/components/ui/PercentRing';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { getStudentTeachers, type StudentTeacher } from '@/api/studentOverview';

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

  const studentId = user?.student_id ?? null;
  const teachersQ = useQuery({ queryKey: ['student-teachers', studentId], queryFn: () => getStudentTeachers(studentId as number), enabled: !!studentId, staleTime: 60_000 });
  const { refreshing, onRefresh } = usePullRefresh(refetchSessions, refetchStats, refetchRisks, refetchBilling, teachersQ.refetch);

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
    { key: 'checkin', icon: 'card' as const, label: t('attendance.check_in'), color: colors.brand, tint: colors.brandTint, onPress: () => router.navigate('/(student)/(tabs)/check-in') },
    { key: 'invoices', icon: 'invoices' as const, label: t('nav.invoices'), color: colors.accent, tint: colors.accentLight, onPress: () => router.navigate('/(student)/(tabs)/invoices') },
    { key: 'swap', icon: 'calendar' as const, label: t('swap.entry'), color: colors.success, tint: colors.successLight, onPress: () => router.navigate('/(student)/swap') },
    { key: 'marks', icon: 'reports' as const, label: t('nav.marks'), color: colors.info, tint: colors.infoLight, onPress: () => router.navigate('/(student)/marks') },
  ];

  const tourScroll = useTourScroll();
  return (
    // Container painted the hero color so a top overscroll reveals the header tone,
    // not the page background (which looked like an ugly gap).
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        {...tourScroll}
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
          {/* Name and date centred at the top (founder 2026-10-05). */}
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.onHero, textAlign: 'center' }}>
            {t('common.greeting', { name: firstName })}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.onHeroSoft, marginTop: 2, textAlign: 'center' }}>
            {formatDate(new Date())}
          </Text>

          <TourTarget id="home:stats"><View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm }}>
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
          </View></TourTarget>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
          {/* Spotlight — the session that matters now, or a calm card when the day is done. */}
          <TourTarget id="home:spotlight">
          {sessionsLoading ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', ...shadows.md }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : spotlight ? (
            <Spotlight s={spotlight} now={now} />
          ) : (
            <TouchableOpacity onPress={() => router.navigate('/(student)/(tabs)/check-in')} activeOpacity={0.9}
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
          </TourTarget>

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
          <TourTarget id="home:shortcuts" style={{ marginTop: spacing.lg }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {shortcuts.map((x) => <ShortcutTile key={x.key} icon={x.icon} label={x.label} color={x.color} tint={x.tint} onPress={x.onPress} />)}
          </View></TourTarget>

          {/* My teachers — who teaches which course, and how attendance stands there. */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHead icon="teacher" color={colors.brand} title={t('home.teachers_title')} />
            {teachersQ.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.lg }} />
            ) : (teachersQ.data ?? []).length === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={[textPresets.bodySmall, { color: colors.textTertiary }]}>{t('home.no_teachers')}</Text>
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {(teachersQ.data ?? []).map((tc) => <TeacherCard key={tc.id} teacher={tc} />)}
              </View>
            )}
          </View>

          {/* Today */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHead icon="sessions" color={colors.brand} title={t('session.today_sessions')} action={t('common.view_all')} onAction={() => router.navigate('/(student)/(tabs)/check-in')} />
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

          {/* Attendance this month — the rate as a ring, the three counts beside it. */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHead icon="attendance" color={colors.success} title={t('home.attendance_overview')} action={t('attendance.tap_for_detail')} onAction={() => router.push('/(student)/attendance')} />
            <TouchableOpacity onPress={() => router.push('/(student)/attendance')} activeOpacity={0.85} accessibilityRole="button" accessibilityHint={t('attendance.tap_for_detail')}
              style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, ...shadows.sm }}>
              <PercentRing value={pct} caption={t('home.attendance_ring_label')} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>
                  {t('home.attendance_ring_hint', { present: formatNumber((stats?.present ?? 0) + (stats?.late ?? 0)), total: formatNumber(total) })}
                </Text>
                {[
                  { v: stats?.present ?? 0, l: t('attendance.present'), bg: colors.successLight, fg: colors.successText, icon: 'present' as const },
                  { v: stats?.excused ?? 0, l: t('attendance.excused'), bg: colors.infoLight, fg: colors.infoText, icon: 'excused' as const },
                  { v: stats?.absent ?? 0, l: t('attendance.absent'), bg: colors.dangerLight, fg: colors.dangerText, icon: 'absent' as const },
                ].map((x) => (
                  <View key={x.l} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: x.bg, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: spacing.sm }}>
                    <Icon name={x.icon} size={15} color={x.fg} />
                    <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: x.fg }}>{x.l}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: x.fg }}>{formatNumber(x.v)}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
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
    <TouchableOpacity onPress={() => router.navigate('/(student)/(tabs)/check-in')} activeOpacity={0.9} accessibilityRole="button" style={{ borderRadius: radius.xxl, overflow: 'hidden', ...shadows.md }}>
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
              <Icon name="card" size={16} color={onWhite.brand} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: onWhite.brand }}>{t('attendance.check_in')}</Text>
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
      onPress={() => router.navigate('/(student)/(tabs)/check-in')}
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

/** One of the student's teachers: the face, the name, and each course with its attendance. */
function TeacherCard({ teacher }: { teacher: StudentTeacher }) {
  const { t } = useTranslation();
  const rate = teacher.total > 0 ? Math.round(teacher.present / teacher.total * 100) : null;
  const tone = rate === null ? colors.textTertiary : rate >= 90 ? colors.success : rate >= 75 ? colors.brand : colors.accent;
  return (
    <TouchableOpacity onPress={() => router.push(`/(student)/teacher/${teacher.id}`)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={teacher.name}
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {teacher.logo_url ? (
          <Image source={{ uri: teacher.logo_url }} style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceSunken }} contentFit="cover" />
        ) : (
          <GeneratedAvatar seed={avatarSeed.user(teacher.id, teacher.name)} size={48} square label={teacher.name} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{teacher.name}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {teacher.courses.map((c) => c.name).join(' · ')}
          </Text>
        </View>
        {rate !== null ? (
          <View style={{ alignItems: 'center', backgroundColor: `${tone}1A`, borderRadius: radius.md, paddingVertical: 4, paddingHorizontal: spacing.sm, minWidth: 54 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: tone }}>{formatNumber(rate)}%</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: tone }}>{t('attendance.attendance_rate')}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: spacing.sm, gap: 6 }}>
        {teacher.courses.map((c) => {
          const cTone = c.rate === null ? colors.textTertiary : c.rate >= 90 ? colors.success : c.rate >= 75 ? colors.brand : colors.accent;
          return (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{c.name}</Text>
              <View style={{ width: 84, height: 6, borderRadius: 3, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                <View style={{ width: `${c.rate ?? 0}%`, height: '100%', borderRadius: 3, backgroundColor: cTone }} />
              </View>
              <Text style={{ width: 64, textAlign: 'left', fontFamily: fonts.bold, fontSize: 12, color: cTone }}>
                {c.total > 0 ? `${formatNumber(c.present)}/${formatNumber(c.total)}` : '—'}
              </Text>
            </View>
          );
        })}
        {teacher.courses.some((c) => c.next_session_at) ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
            {t('home.next_session_short', { when: formatDate(new Date(teacher.courses.filter((c) => c.next_session_at).sort((x, y) => String(x.next_session_at).localeCompare(String(y.next_session_at)))[0].next_session_at as string), { weekday: 'long', day: 'numeric', month: 'short' }) })}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('attendance.tap_for_detail')}</Text>
        <Icon name="back" size={13} color={colors.brand} />
      </View>
    </TouchableOpacity>
  );
}
