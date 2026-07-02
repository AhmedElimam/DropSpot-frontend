import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useCoverageStats } from '@/hooks/useAttendance';
import { useQuizzes } from '@/hooks/useQuizzes';
import { formatDate } from '@/utils/format';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SettingItem {
  key: string;
  icon: string;
  type: 'link' | 'toggle';
  color: string;
}

const accountSettings: SettingItem[] = [
  { key: 'profile.personal_info', icon: '👤', type: 'link', color: colors.primary },
  { key: 'profile.notifications', icon: '🔔', type: 'toggle', color: colors.accent },
];

const appSettings: SettingItem[] = [
  { key: 'profile.language', icon: '🌐', type: 'link', color: colors.warning },
  { key: 'profile.about', icon: 'ℹ️', type: 'link', color: colors.info },
  { key: 'profile.contact_support', icon: '📞', type: 'link', color: colors.success },
];

export default function StudentProfile() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: coverage } = useCoverageStats();
  const { data: quizzes } = useQuizzes();
  const [notifEnabled, setNotifEnabled] = useState(true);

  const sessionsAttended = coverage ? coverage.present + coverage.late : 0;
  const quizzesCompleted = (quizzes ?? []).filter((q: any) => q.status === 'completed').length;
  const avgScore = coverage && coverage.total > 0 ? Math.round(((coverage.present + coverage.late) / coverage.total) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
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
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs }}>{user?.email}</Text>
          <View style={{ marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff' }}>{t('profile.role_student')}</Text>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md }}>
          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
            <Text style={[textPresets.label, { marginBottom: spacing.md, color: colors.textTertiary }]}>
              {t('profile.account')}
            </Text>
            {accountSettings.map((item, index) => (
              <TouchableOpacity
                key={item.key}
                disabled={item.type === 'toggle'}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: index < accountSettings.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: item.color + '18', justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                </View>
                <Text style={[textPresets.body, { flex: 1 }]}>{t(item.key)}</Text>
                {item.type === 'toggle' ? (
                  <Switch value={notifEnabled} onValueChange={setNotifEnabled} trackColor={{ false: colors.borderLight, true: colors.primaryLight }} thumbColor={notifEnabled ? colors.primary : colors.textTertiary} />
                ) : (
                  <Text style={{ fontSize: 18, color: colors.textTertiary, transform: [{ scaleX: -1 }] }}>{'<'}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
            <Text style={[textPresets.label, { marginBottom: spacing.md, color: colors.textTertiary }]}>
              {t('profile.app')}
            </Text>
            {appSettings.map((item, index) => (
              <TouchableOpacity
                key={item.key}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: index < appSettings.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: item.color + '18', justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                </View>
                <Text style={[textPresets.body, { flex: 1 }]}>{t(item.key)}</Text>
                <Text style={{ fontSize: 18, color: colors.textTertiary, transform: [{ scaleX: -1 }] }}>{'<'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
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
              <Text style={textPresets.bodySmall}>{t('profile.avg_score')}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{avgScore}%</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => logout.mutate()} activeOpacity={0.85} style={{ borderRadius: radius.md, overflow: 'hidden' }}>
            <LinearGradient colors={['#EF4444', '#DC2626']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('common.logout')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[textPresets.caption, { textAlign: 'center', marginTop: spacing.md }]}>DrosSpot v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}
