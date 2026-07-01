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

const childGradients = [
  ['#6366F1', '#8B5CF6'] as const,
  ['#10B981', '#059669'] as const,
  ['#F59E0B', '#D97706'] as const,
];

export default function ChildrenList() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1E1B4B', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.white, letterSpacing: -0.5 }}>
                {t('parent.my_children')}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                {MOCK_CHILDREN.length} {t('common.all')}
              </Text>
            </View>
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <Text style={{ fontSize: 22 }}>👨‍👩‍👧‍👦</Text>
            </LinearGradient>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md }}>
          {MOCK_CHILDREN.map((child, index) => {
            const cg = childGradients[index % childGradients.length];
            return (
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
                  colors={['rgba(99,102,241,0.03)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: spacing.xl }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <LinearGradient
                      colors={cg}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center', ...shadows.glow }}
                    >
                      <Text style={{ fontSize: 22, color: '#fff' }}>{(child.name || '?')[0]}</Text>
                    </LinearGradient>
                    <View style={{ marginStart: spacing.md, flex: 1 }}>
                      <Text style={[textPresets.subtitle, { fontFamily: fonts.bold }]}>{child.name}</Text>
                      <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{child.grade}</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                      <Text style={textPresets.caption}>{t('attendance.attendance_rate')}</Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: child.attendanceRate >= 90 ? colors.success : child.attendanceRate >= 75 ? colors.primary : colors.warning }}>
                        {child.attendanceRate}%
                      </Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                      <LinearGradient
                        colors={child.attendanceRate >= 90 ? gradients.success : child.attendanceRate >= 75 ? gradients.primary : gradients.warm}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ width: `${child.attendanceRate}%`, height: '100%', borderRadius: 4 }}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm }}>
                    <View style={{ flex: 1, backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.primary }}>{child.sessions}</Text>
                      <Text style={textPresets.caption}>{t('session.today_sessions')}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: colors.dangerLight, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.danger }}>{child.absent}</Text>
                      <Text style={textPresets.caption}>{t('attendance.absent')}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: colors.warningLight, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.warning }}>{child.sessions + child.absent}</Text>
                      <Text style={textPresets.caption}>إجمالي</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => router.push(`/(parent)/child/${child.id}`)}
                    activeOpacity={0.8}
                    style={{ marginTop: spacing.md }}
                  >
                    <LinearGradient
                      colors={cg}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('reports.view_details')}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
