import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatTime } from '@/utils/format';

const MOCK_SESSIONS = [
  { id: '1', course_name: 'الرياضيات', teacher_name: 'أحمد محمد', time: '10:00', duration: 90, status: 'scheduled' as const, location: 'قاعة 3' },
  { id: '2', course_name: 'العلوم', teacher_name: 'سارة علي', time: '12:30', duration: 90, status: 'scheduled' as const, location: 'معمل العلوم' },
  { id: '3', course_name: 'اللغة العربية', teacher_name: 'خالد حسن', time: '14:00', duration: 60, status: 'completed' as const, location: 'قاعة 1' },
];

const statusDot: Record<string, string> = {
  live: colors.success,
  scheduled: colors.warning,
  completed: colors.info,
  cancelled: colors.danger,
};

export default function StudentDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#4F46E5', '#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.white, letterSpacing: -0.5 }}>
            {t('common.greeting', { name: user?.name || '' })}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: spacing.xs }}>
            {formatDate(new Date())}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{MOCK_SESSIONS.length}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{t('session.today_sessions')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>2</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{t('session.upcoming_sessions')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>1</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{t('attendance.absent')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
            <Text style={[textPresets.h3, { marginBottom: spacing.md }]}>
              {t('nav.check_in')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => router.navigate('/(student)/check-in')}
                activeOpacity={0.8}
                style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden' }}
              >
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, marginBottom: spacing.xs }}>{'📌'}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t('attendance.check_in')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.navigate('/(student)/quiz')}
                activeOpacity={0.8}
                style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden' }}
              >
                <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, marginBottom: spacing.xs }}>{'📝'}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t('nav.quiz')}</Text>
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

          {MOCK_SESSIONS.map((session) => {
            const endTime = new Date();
            const [h, m] = session.time.split(':').map(Number);
            endTime.setHours(h, m + session.duration);
            return (
              <TouchableOpacity
                key={session.id}
                onPress={() => router.navigate('/(student)/check-in')}
                activeOpacity={0.7}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: radius.xl,
                  padding: spacing.xl,
                  ...shadows.md,
                  borderStartWidth: 4,
                  borderStartColor: statusDot[session.status] || colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={textPresets.subtitle}>{session.course_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginEnd: 4 }}>{'👤'}</Text>
                        <Text style={textPresets.bodySmall}>{session.teacher_name}</Text>
                      </View>
                      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.border }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginEnd: 4 }}>{'📍'}</Text>
                        <Text style={textPresets.bodySmall}>{session.location}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: statusDot[session.status] + '18', paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusDot[session.status], marginEnd: 6 }} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: statusDot[session.status] }}>
                      {session.status === 'completed' ? t('session.completed') : t('session.scheduled')}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.md }}>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginEnd: 6 }}>{'🕐'}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.primary }}>
                      {formatTime(new Date(2026, 5, 30, h, m))} - {formatTime(endTime)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
            <Text style={textPresets.h3}>{t('attendance.attendance_rate')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.md }}>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: '85%', height: '100%', borderRadius: 4 }} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.primary }}>85%</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md }}>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.success }}>12</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary }}>{t('attendance.present')}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.warning }}>2</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary }}>{t('attendance.excused')}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.danger }}>1</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary }}>{t('attendance.absent')}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
