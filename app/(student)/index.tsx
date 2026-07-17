import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useTodaySessions } from '@/hooks/useSessions';
import { useCoverageStats } from '@/hooks/useAttendance';
import { formatDate, formatTime } from '@/utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
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
  const { data: sessions, isLoading: sessionsLoading } = useTodaySessions();
  const { data: stats } = useCoverageStats();

  const total = stats?.total ?? 0;
  const pct = total > 0 ? Math.round(((stats?.present ?? 0) + (stats?.late ?? 0)) / total * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.xl4 }}
        >
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
                onPress={() => router.navigate('/(student)/quiz')}
                activeOpacity={0.85}
                style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden' }}
              >
                <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <Icon name="quiz" size={24} color={colors.onAccent} style={{ marginBottom: spacing.xs }} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.onAccent }}>{t('nav.quiz')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
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
                    borderColor: colors.border,
                    ...shadows.sm,
                    borderStartWidth: 4,
                    borderStartColor: statusDot[session.status] || colors.border,
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
                    <StatusBadge status={session.status} size="sm" />
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
