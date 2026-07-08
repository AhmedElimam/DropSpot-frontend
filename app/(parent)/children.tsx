import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';

const childGradients = [
  ['#6366F1', '#8B5CF6'] as const,
  ['#10B981', '#059669'] as const,
  ['#F59E0B', '#D97706'] as const,
];

export default function ChildrenList() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: children, isLoading, isError, refetch } = useChildren();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (!children || children.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState icon="children" title={t('parent.no_children')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1E1B4B', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.white, letterSpacing: -0.5 }}>
                {t('parent.my_children')}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                {t('common.children_count', { count: children.length })}
              </Text>
            </View>
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <Icon name="children" size={24} color="#fff" outline />
            </LinearGradient>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md }}>
          {children.map((child, index) => {
            const cg = childGradients[index % childGradients.length];
            const rate = child.attendance_rate ?? 0;
            return (
              <TouchableOpacity
                key={child.id}
                onPress={() => router.push(`/(parent)/child/${child.id}`)}
                activeOpacity={0.7}
                style={{ backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden', ...shadows.md }}
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
                      style={{ width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 22, color: '#fff' }}>{(child.name || '?')[0]}</Text>
                    </LinearGradient>
                    <View style={{ marginStart: spacing.md, flex: 1 }}>
                      <Text style={[textPresets.subtitle, { fontFamily: fonts.bold }]}>{child.name}</Text>
                      <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{child.grade}</Text>
                      {child.teachers && child.teachers.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: 4, flexWrap: 'wrap' }}>
                          {child.teachers.slice(0, 2).map((t) => (
                            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, paddingVertical: 1, paddingHorizontal: 6, borderRadius: radius.full }}>
                              <Icon name="teacher" size={12} color={colors.primary} outline style={{ marginEnd: 2 }} />
                              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.primary }}>{t.name}</Text>
                            </View>
                          ))}
                          {child.teachers.length > 2 && (
                            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>+{child.teachers.length - 2}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={{ marginTop: spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                      <Text style={textPresets.caption}>{t('attendance.attendance_rate')}</Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: rate >= 90 ? colors.success : rate >= 75 ? colors.primary : colors.warning }}>
                        {rate}%
                      </Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                      <LinearGradient
                        colors={rate >= 90 ? ['#10B981', '#059669'] : rate >= 75 ? ['#6366F1', '#8B5CF6'] : ['#F59E0B', '#D97706']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ width: `${rate}%`, height: '100%', borderRadius: 4 }}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xs }}>
                    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.sm, paddingVertical: 8 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.successText }}>{child.present_count ?? 0}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.successText }}>{t('attendance.present')}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.sm, paddingVertical: 8 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.dangerText }}>{child.absent_count ?? 0}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.dangerText }}>{t('attendance.absent')}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.warningLight, borderRadius: radius.sm, paddingVertical: 8 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.warningText }}>{child.late_count ?? 0}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningText }}>{t('attendance.late')}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingVertical: 8 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.infoText }}>{child.excused_count ?? 0}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.infoText }}>{t('attendance.excused')}</Text>
                    </View>
                  </View>

                  {child.student_code && (
                    <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
                      <Icon name="card" size={14} color={colors.textSecondary} outline style={{ marginEnd: 4 }} />
                      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('child_settings.student_code')}: {child.student_code}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => router.push(`/(parent)/child/${child.id}`)}
                    activeOpacity={0.8}
                    style={{ marginTop: spacing.md }}
                  >
                    <LinearGradient
                      colors={cg}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ minHeight: 48, justifyContent: 'center', borderRadius: radius.md, alignItems: 'center' }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('reports.view_details')}</Text>
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
