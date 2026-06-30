import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatTime } from '@/utils/format';

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

export default function ParentNotifications() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const unreadCount = MOCK_ACTIVITIES.filter((a) => !a.isRead).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxxl }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', letterSpacing: -0.5 }}>
                {t('activity.title')}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs }}>
                {formatDate(new Date())}
              </Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff', marginEnd: 6 }}>{unreadCount}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{t('notifications.title')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.sm }}>
          {MOCK_ACTIVITIES.map((activity) => {
            const cfg = typeConfig[activity.type];
            return (
              <TouchableOpacity
                key={activity.id}
                activeOpacity={0.7}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: radius.xl,
                  padding: spacing.xl,
                  ...shadows.md,
                  borderStartWidth: 4,
                  borderStartColor: cfg.gradient[0],
                  opacity: activity.isRead ? 0.8 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <LinearGradient
                    colors={cfg.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}
                  >
                    <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      {activity.childName ? (
                        <Text style={[textPresets.label, { color: colors.textPrimary }]}>{activity.childName}</Text>
                      ) : null}
                      {!activity.isRead && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cfg.gradient[0] }} />}
                    </View>
                    <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{activity.description}</Text>
                    <Text style={[textPresets.caption, { marginTop: 4 }]}>{timeAgo(activity.time)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
