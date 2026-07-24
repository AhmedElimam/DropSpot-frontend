import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useCoverageStats } from '@/hooks/useAttendance';
import { useQuizzes } from '@/hooks/useQuizzes';
import { formatDate } from '@/utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { Icon } from '@/components/ui/Icon';

export default function StudentProfile() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: coverage } = useCoverageStats();
  const { data: quizzes } = useQuizzes();

  const sessionsAttended = coverage ? coverage.present + coverage.late : 0;
  const now = new Date();
  const quizzesCompleted = (quizzes ?? []).filter(
    (q) => !q.is_active || (q.ends_at ? new Date(q.ends_at) < now : false)
  ).length;
  const attendanceRate = coverage && coverage.total > 0
    ? Math.round(((coverage.present + coverage.late) / coverage.total) * 100)
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl5, alignItems: 'center' }}
        >
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)', marginBottom: spacing.md }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 36, color: '#fff' }}>{(user?.name || '?')[0]}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{user?.name}</Text>
          {user?.student_code ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs, letterSpacing: 1 }}>
              {user.student_code}
            </Text>
          ) : null}
          <View style={{ marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff' }}>{t('profile.role_student')}</Text>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md }}>
          {/* Digital card — the student's QR for check-in when the physical card
              is forgotten/lost. Encodes the same student_code the scanner reads. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm, alignItems: 'center' }}>
            <Text style={[textPresets.label, { marginBottom: spacing.md, color: colors.textTertiary }]}>
              {t('profile.my_card')}
            </Text>
            {user?.student_code ? (
              <>
                <View style={{ padding: spacing.md, backgroundColor: '#fff', borderRadius: radius.lg }}>
                  <QRCode value={user.student_code} size={200} />
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginTop: spacing.md, letterSpacing: 2 }}>
                  {user.student_code}
                </Text>
                <Text style={[textPresets.caption, { textAlign: 'center', marginTop: spacing.xs }]}>
                  {t('profile.show_to_teacher')}
                </Text>
              </>
            ) : (
              <Text style={[textPresets.bodySmall, { textAlign: 'center' }]}>{t('profile.no_code_yet')}</Text>
            )}
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <Text style={[textPresets.label, { marginBottom: spacing.md, color: colors.textTertiary }]}>
              {t('profile.account')}
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.md }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                <Icon name="bell" size={20} color={colors.primary} outline />
              </View>
              <Text style={[textPresets.body, { flex: 1 }]}>{t('profile.notifications')}</Text>
              <Icon name="back" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <Text style={[textPresets.label, { marginBottom: spacing.md, color: colors.textTertiary }]}>
              {t('profile.account_info')}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text style={textPresets.bodySmall}>{t('profile.member_since')}</Text>
              <Text style={[textPresets.bodySmall, { fontFamily: fonts.medium, color: colors.textPrimary }]}>
                {user?.created_at ? formatDate(new Date(user.created_at), { month: 'long', year: 'numeric' }) : '-'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text style={textPresets.bodySmall}>{t('profile.sessions_attended')}</Text>
              <Text style={[textPresets.bodySmall, { fontFamily: fonts.medium, color: colors.textPrimary }]}>{sessionsAttended}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text style={textPresets.bodySmall}>{t('profile.quizzes_completed')}</Text>
              <Text style={[textPresets.bodySmall, { fontFamily: fonts.medium, color: colors.textPrimary }]}>{quizzesCompleted}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text style={textPresets.bodySmall}>{t('attendance.attendance_rate')}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{attendanceRate}%</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => logout.mutate()} activeOpacity={0.85} style={{ borderRadius: radius.md, overflow: 'hidden' }}>
            <LinearGradient colors={[colors.dangerDark, colors.danger]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ minHeight: 52, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="logout" size={20} color="#fff" outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('common.logout')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[textPresets.caption, { textAlign: 'center', marginTop: spacing.md }]}>DrosSpot v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}
