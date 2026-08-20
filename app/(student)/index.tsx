import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, layout } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useTodaySessions } from '@/hooks/useSessions';
import { useStudentAttendanceRisk } from '@/hooks/useAttendance';
import { useStudentBillingStatus, useStudentPendingDues } from '@/hooks/useInvoices';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useUnreadCount } from '@/hooks/useNotifications';
import { AttendanceRiskCard } from '@/components/attendance/AttendanceRiskCard';
import { BillingOverdueCard } from '@/components/attendance/BillingOverdueCard';
import { CardOrderBanner } from '@/components/cardOrder/CardOrderBanner';
import { PendingDueRow } from '@/components/parent/PendingDueRow';
import { formatDate, formatTime } from '@/utils/format';
import { toArabicDigits } from '@/utils/numerals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { HeroCard } from '@/components/ui/HeroCard';
import { Timeline, type TimelineItem } from '@/components/ui/Timeline';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { SessionInstance } from '@/types/session-instance';

/** Header: greeting + date on the right, avatar + bell action tiles on the left. */
function HomeHeader({ name, onBell, unread }: { name: string; onBell: () => void; unread: number }) {
  const { t } = useTranslation();
  const initial = (name || '?').trim().charAt(0) || '؟';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 23, color: colors.ink, letterSpacing: -0.3 }} numberOfLines={1}>
          {t('common.greeting', { name })}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 }}>
          {formatDate(new Date())}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TouchableOpacity
          onPress={onBell}
          accessibilityRole="button"
          style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="bell" size={22} color={colors.ink} outline />
          {unread > 0 ? (
            <View style={{ position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, borderWidth: 1, borderColor: colors.surface }} />
          ) : null}
        </TouchableOpacity>
        <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff' }}>{initial}</Text>
        </View>
      </View>
    </View>
  );
}

/** Section header: bold title on the right, optional "view all" action on the left. */
function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function StudentDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useTodaySessions();
  const { data: risks, refetch: refetchRisks } = useStudentAttendanceRisk();
  const { data: billingAlerts, refetch: refetchBilling } = useStudentBillingStatus();
  const { data: dues, refetch: refetchDues } = useStudentPendingDues();
  const { data: unread } = useUnreadCount();
  const { refreshing, onRefresh } = usePullRefresh(refetchSessions, refetchRisks, refetchBilling, refetchDues);

  const today = useMemo(() => [...(sessions ?? [])].sort(
    (a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at),
  ), [sessions]);

  // The hero = the soonest still-scheduled session today (what to do next).
  const heroSession = useMemo(
    () => today.find((s) => s.status === 'scheduled') ?? null,
    [today],
  );

  const heroPill = useMemo(() => {
    if (!heroSession) return undefined;
    const mins = Math.round((+new Date(heroSession.scheduled_at) - Date.now()) / 60000);
    if (mins <= 0) return { label: t('session.live_now'), live: true };
    return { label: t('session.starts_in_min', { count: mins }), live: mins <= 30 };
  }, [heroSession, t]);

  const heroMeta = (s: SessionInstance): string[] => {
    const start = new Date(s.scheduled_at);
    const end = new Date(start.getTime() + s.duration_minutes * 60000);
    const time = `${formatTime(start)} — ${formatTime(end)}`;
    return [s.location ? `${time} · ${s.location}` : time];
  };

  const timelineItems: TimelineItem[] = today.map((s) => ({
    id: s.id,
    state: s.status === 'completed' ? 'done' : s.id === heroSession?.id ? 'now' : 'upcoming',
    time: formatTime(s.scheduled_at),
    title: `${s.course_name} — ${s.teacher_name}`,
    subtitle: s.attendance_status ? undefined : (s.location ?? undefined),
    chip: s.attendance_status ? <StatusBadge status={s.attendance_status} size="sm" /> : undefined,
    onPress: () => router.navigate('/(student)/check-in'),
  }));

  const hasDues = (dues ?? []).length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: insets.top + spacing.md, paddingBottom: layout.tabBottom + insets.bottom, gap: layout.sectionGap }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <HomeHeader
          name={user?.name || ''}
          onBell={() => router.navigate('/(student)/notifications' as never)}
          unread={unread ?? 0}
        />

        {/* Alerts sit ABOVE the hero — a blocked check-in / overdue bill outranks
            what's next (spec §2, §3.6). */}
        <View style={{ gap: layout.cardGap }}>
          <CardOrderBanner scope="student" />
          {(billingAlerts ?? []).map((alert, i) => (
            <BillingOverdueCard key={`bill-${alert.student_id}-${i}`} alert={alert} />
          ))}
          {(risks ?? []).map((risk, i) => (
            <AttendanceRiskCard key={`${risk.student_id}-${risk.course_name ?? i}`} risk={risk} />
          ))}
        </View>

        {/* Hero — the next session + check-in CTA */}
        {heroSession ? (
          <HeroCard
            pill={heroPill}
            title={`${heroSession.course_name} — ${heroSession.teacher_name}`}
            meta={heroMeta(heroSession)}
            primary={{ label: t('attendance.check_in'), icon: 'scan', onPress: () => router.navigate('/(student)/check-in') }}
            footnote={t('attendance.window_opens_hint')}
          />
        ) : (
          <HeroCard
            title={t('session.no_sessions_today')}
            meta={[t('session.no_sessions_today_desc')]}
          />
        )}

        {/* Today's timeline */}
        <View style={{ gap: layout.cardGap }}>
          <SectionHeader title={t('session.today_sessions')} />
          {sessionsLoading ? (
            <SkeletonList count={3} />
          ) : timelineItems.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line }}>
              <EmptyState icon="calendar" title={t('session.no_sessions')} />
            </View>
          ) : (
            <Timeline items={timelineItems} />
          )}
        </View>

        {/* Dues */}
        {hasDues ? (
          <View style={{ gap: layout.cardGap }}>
            <SectionHeader title={t('invoices.dues')} actionLabel={t('common.all')} onAction={() => router.navigate('/(student)/invoices')} />
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, overflow: 'hidden' }}>
              {(dues ?? []).map((due, i) => (
                <View key={`due-${due.id}`} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.line } : undefined}>
                  <PendingDueRow due={due} onPress={() => router.navigate('/(student)/invoices')} />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
