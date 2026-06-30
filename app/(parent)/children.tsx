import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';

const MOCK_CHILDREN = [
  { id: '1', name: 'يوسف أحمد', grade: 'الصف الثالث الإعدادي', attendanceRate: 92, sessions: 24, absent: 2 },
  { id: '2', name: 'مريم أحمد', grade: 'الصف الأول الإعدادي', attendanceRate: 88, sessions: 18, absent: 4 },
  { id: '3', name: 'سارة أحمد', grade: 'الصف الثاني الإعدادي', attendanceRate: 95, sessions: 20, absent: 1 },
];

const avatarColors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function ChildrenList() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.white, letterSpacing: -0.5 }}>
                {t('parent.my_children')}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                {MOCK_CHILDREN.length} {t('common.all')}
              </Text>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontSize: 20 }}>👤</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md }}>
          {MOCK_CHILDREN.map((child, index) => (
            <TouchableOpacity
              key={child.id}
              onPress={() => router.push(`/(parent)/child/${child.id}`)}
              activeOpacity={0.7}
              style={{
                backgroundColor: colors.white,
                borderRadius: radius.xl,
                overflow: 'hidden',
                ...shadows.md,
              }}
            >
              <LinearGradient
                colors={['rgba(99,102,241,0.04)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: spacing.xl }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 20, color: '#fff' }}>{(child.name || '?')[0]}</Text>
                  </LinearGradient>
                  <View style={{ marginStart: spacing.md, flex: 1 }}>
                    <Text style={textPresets.subtitle}>{child.name}</Text>
                    <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{child.grade}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: child.attendanceRate >= 90 ? colors.success : child.attendanceRate >= 75 ? colors.primary : colors.warning }}>
                      {child.attendanceRate}%
                    </Text>
                    <Text style={textPresets.caption}>{t('attendance.attendance_rate')}</Text>
                  </View>
                </View>

                <LinearGradient
                  colors={gradients.surface}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flexDirection: 'row', marginTop: spacing.lg, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.borderLight }}
                >
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.primary }}>{child.sessions}</Text>
                    <Text style={textPresets.caption}>{t('session.today_sessions')}</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.borderLight }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.danger }}>{child.absent}</Text>
                    <Text style={textPresets.caption}>{t('attendance.absent')}</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.borderLight }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.warning }}>
                      {child.sessions + child.absent}
                    </Text>
                    <Text style={textPresets.caption}>إجمالي</Text>
                  </View>
                </LinearGradient>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
