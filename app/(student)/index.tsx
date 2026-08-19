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
import { AttendanceRiskCard } from '@/components/attendance/AttendanceRiskCard';
import { BillingOverdueCard } from '@/components/attendance/BillingOverdueCard';
import { CardOrderBanner } from '@/components/cardOrder/CardOrderBanner';
import { formatDate, formatTime } from '@/utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { HeaderBrandBar } from '@/components/ui/HeaderBrandBar';
import { StatusBadge } from '@/components/ui/StatusBadge';

const statusDot: Record<string, string> = {
  live: colors.success,
  scheduled: colors.warning,
  completed: colors.info,
  cancelled: colors.danger,
};

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

  return (
    // Container painted the hero color so a top overscroll reveals the header tone,
    // not the cream page background (which looked like an ugly gap).
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
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.xl4 }}
        >
          <HeaderBrandBar onBell={() => router.navigate('/(student)/notifications' as never)} unread={unread} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.white, letterSpacing: -0.5 }}>
            {t('common.greeting', { name: user?.name || '' })}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: spacing.xs }}>
            {formatDate(new Date())}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{sessions?.length ?? 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 2, textAlign: 'center' }}>{t('session.today_sessions')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{sessions?.filter((s) => s.status === 'scheduled').length ?? 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 2, textAlign: 'center' }}>{t('session.upcoming_sessions')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{stats?.absent ?? 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 2, textAlign: 'center' }}>{t('attendance.absent')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          <CardOrderBanner scope="student" />
          {(billingAlerts ?? []).map((alert, i) => (
            <BillingOverdueCard key={`bill-${alert.student_id}-${i}`} alert={alert} />
          ))}
          {(risks ?? []).map((risk, i) => (
            <AttendanceRiskCard key={`${risk.student_id}-${risk.course_name ?? i}`} risk={risk} />
          ))}

          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <Text style={[textPresets.h3, { marginBottom: spacing.md }]}>
              {t('nav.check_in')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => router.navigate('/(student)/check-in')}
                activeOpacity={0.85}
                style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden' }}
              >
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <Icon name="card" size={24} color="#fff" style={{ marginBottom: spacing.xs }} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('attendance.check_in')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.navigate('/(student)/invoices')}
                activeOpacity={0.85}
                style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden' }}
              >
                <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <Icon name="invoices" size={24} color={colors.onAccent} style={{ marginBottom: spacing.xs }} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.onAccent }}>{t('nav.invoices')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => router.navigate('/(student)/swap')}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryLight }}
            >
              <Icon name="calendar" size={18} color={colors.primary} outline style={{ marginEnd: spacing.xs }} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{t('swap.entry')}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={textPresets.h3}>{t('session.today_sessions')}</Text>
            <TouchableOpacity onPress={() => router.navigate('/(student)/check-in')}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.primary }}>{t('common.view_all')}</Text>
            </TouchableOpacity>
          </View>

          {sessionsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
          ) : (sessions ?? []).length === 0 ? (
            <Text style={[textPresets.bodySmall, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl }]}>{t('session.no_sessions')}</Text>
          ) : (
            (sessions ?? []).map((session) => {
              const start = new Date(session.scheduled_at);
              const end = new Date(start.getTime() + session.duration_minutes * 60000);
              // "Starting soon" = scheduled and within 4 hours of the start time.
              const msToStart = start.getTime() - Date.now();
              const startingSoon = session.status === 'scheduled' && !session.attendance_status
                && msToStart > 0 && msToStart <= 4 * 60 * 60 * 1000;
              return (
                <TouchableOpacity
                  key={session.id}
                  onPress={() => router.navigate('/(student)/check-in')}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.xl,
                    padding: spacing.xl,
                    borderWidth: 1,
                    borderColor: startingSoon ? colors.brand : colors.border,
                    ...shadows.sm,
                    borderStartWidth: 4,
                    borderStartColor: startingSoon ? colors.brand : (statusDot[session.status] || colors.border),
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={textPresets.subtitle}>{session.course_name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Icon name="teacher" size={13} color={colors.textTertiary} outline style={{ marginEnd: 4 }} />
                          <Text style={textPresets.bodySmall}>{session.teacher_name}</Text>
                        </View>
                        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.border }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Icon name="location" size={13} color={colors.textTertiary} outline style={{ marginEnd: 4 }} />
                          <Text style={textPresets.bodySmall}>{session.location}</Text>
                        </View>
                      </View>
                    </View>
                    {/* Prefer the student's OWN outcome (present/late/absent/excused)
                        once recorded; a "starting soon" chip flags the next 4h window;
                        else fall back to the session lifecycle. */}
                    {startingSoon ? (
                      <View style={{ backgroundColor: colors.brandTint, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('attendance.starting_soon')}</Text>
                      </View>
                    ) : (
                      <StatusBadge status={session.attendance_status ?? session.status} size="sm" />
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brandTint, paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.md }}>
                      <Icon name="clock" size={13} color={colors.brand} outline style={{ marginEnd: 6 }} />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>
                        {formatTime(start)} - {formatTime(end)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <Text style={textPresets.h3}>{t('attendance.attendance_rate')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.md }}>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${pct}%`, height: '100%', borderRadius: 4 }} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.brand }}>{pct}%</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md }}>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.successText }}>{stats?.present ?? 0}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('attendance.present')}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.infoLight, borderRadius: radius.md, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.infoText }}>{stats?.excused ?? 0}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('attendance.excused')}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.dangerText }}>{stats?.absent ?? 0}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('attendance.absent')}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
