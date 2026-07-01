import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';

interface Activity {
  id: string;
  type: 'absence' | 'grade' | 'invoice' | 'schedule';
  childName: string;
  description: string;
  time: Date;
  isRead: boolean;
}

const MOCK_ACTIVITIES: Activity[] = [
  { id: '1', type: 'absence', childName: 'يوسف أحمد', description: 'غائب عن حصة الرياضيات', time: new Date(Date.now() - 30 * 60000), isRead: false },
  { id: '2', type: 'grade', childName: 'مريم أحمد', description: 'حصلت على 92% في اختبار الجبر', time: new Date(Date.now() - 2 * 3600000), isRead: false },
  { id: '3', type: 'absence', childName: 'يوسف أحمد', description: 'غائب عن حصة العلوم', time: new Date(Date.now() - 5 * 3600000), isRead: true },
  { id: '4', type: 'invoice', childName: '', description: 'فاتورة شهر يوليو مستحقة الدفع', time: new Date(Date.now() - 24 * 3600000), isRead: true },
  { id: '5', type: 'schedule', childName: 'مريم أحمد', description: 'تم تغيير موعد حصة اللغة العربية', time: new Date(Date.now() - 48 * 3600000), isRead: true },
  { id: '6', type: 'grade', childName: 'يوسف أحمد', description: 'حصل على 88% في اختبار النحو', time: new Date(Date.now() - 72 * 3600000), isRead: true },
];

const typeConfig: Record<string, { icon: string; gradient: readonly [string, string] }> = {
  absence: { icon: '⚠️', gradient: ['#EF4444', '#DC2626'] },
  grade: { icon: '🎯', gradient: ['#10B981', '#059669'] },
  invoice: { icon: '💳', gradient: ['#F59E0B', '#D97706'] },
  schedule: { icon: '📅', gradient: ['#6366F1', '#4F46E5'] },
};

const quickActions = [
  { icon: '👨‍👩‍👧‍👦', label: 'nav.children', route: '/(parent)/children', gradient: ['#6366F1', '#8B5CF6'] as const },
  { icon: '💳', label: 'nav.invoices', route: '/(parent)/invoices', gradient: ['#10B981', '#059669'] as const },
  { icon: '📊', label: 'nav.reports', route: '/(parent)/reports', gradient: ['#6366F1', '#8B5CF6'] as const },
  { icon: '📊', label: 'activity.title', route: '', gradient: ['#F59E0B', '#D97706'] as const },
];

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

export default function ParentHome() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const unreadCount = MOCK_ACTIVITIES.filter((a) => !a.isRead).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1E1B4B', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
                {t('common.greeting', { name: '' })}
              </Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: '#fff', letterSpacing: -0.5, marginTop: 2 }}>
                {user?.name || 'ولي الأمر'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4, direction: 'ltr', textAlign: 'left' }}>
                {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
            <View style={{ position: 'relative' }}>
              <LinearGradient
                colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
              >
                <Text style={{ fontSize: 22 }}>🔔</Text>
              </LinearGradient>
              {unreadCount > 0 && (
                <View style={{ position: 'absolute', top: -4, start: -4, backgroundColor: colors.danger, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1E1B4B' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>3</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('nav.children')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{unreadCount}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('notifications.title')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>12</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('session.today_sessions')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {quickActions.map((action, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { if (action.route) router.push(action.route as any); }}
                activeOpacity={0.8}
                style={{ width: '48%', backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden', ...shadows.md }}
              >
                <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(248,250,252,0.95)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <LinearGradient colors={action.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm }}>
                    <Text style={{ fontSize: 22 }}>{action.icon}</Text>
                  </LinearGradient>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{t(action.label)}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={textPresets.h3}>{t('activity.title')}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>{t('reports.view_details')}</Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            {MOCK_ACTIVITIES.map((activity) => {
              const cfg = typeConfig[activity.type];
              return (
                <TouchableOpacity
                  key={activity.id}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: colors.white,
                    borderRadius: radius.xl,
                    padding: spacing.lg,
                    ...shadows.sm,
                    borderStartWidth: 3,
                    borderStartColor: cfg.gradient[0],
                    opacity: activity.isRead ? 0.65 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <LinearGradient
                      colors={cfg.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}
                    >
                      <Text style={{ fontSize: 16 }}>{cfg.icon}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        {activity.childName ? (
                          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{activity.childName}</Text>
                        ) : null}
                        {!activity.isRead && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.gradient[0] }} />}
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{activity.description}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>{timeAgo(activity.time)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
