import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Avatar } from '@/components/layout/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

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
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: '#fff', letterSpacing: -0.5 }}>
                {t('parent.my_children')}
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
                {t('common.children_count', { count: children.length })}
              </Text>
            </View>
            <View style={{ width: 48, height: 48, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Icon name="children" size={24} color="#fff" outline />
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md }}>
          {children.map((child) => {
            const rate = child.attendance_rate ?? 0;
            const rateColor = rate >= 90 ? colors.success : rate >= 75 ? colors.brand : colors.warning;
            return (
              <TouchableOpacity
                key={child.id}
                onPress={() => router.push(`/(parent)/child/${child.id}`)}
                activeOpacity={0.75}
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xxl, padding: spacing.xl, ...shadows.sm }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar name={child.name} size={56} />
                  <View style={{ marginStart: spacing.md, flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }}>{child.name}</Text>
                    <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{child.grade}</Text>
                    {child.teachers && child.teachers.length > 0 && (
                      <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: 6, flexWrap: 'wrap' }}>
                        {child.teachers.slice(0, 2).map((teacher) => (
                          <View key={teacher.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brandTint, paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full }}>
                            <Icon name="teacher" size={13} color={colors.brand} outline style={{ marginEnd: 3 }} />
                            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{teacher.name}</Text>
                          </View>
                        ))}
                        {child.teachers.length > 2 && (
                          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>+{child.teachers.length - 2}</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                <View style={{ marginTop: spacing.lg }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('attendance.attendance_rate')}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: rateColor }}>
                      {rate}%
                    </Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                    <View style={{ width: `${rate}%`, height: '100%', borderRadius: 4, backgroundColor: rateColor }} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xs }}>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.successText }}>{child.present_count ?? 0}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.successText }}>{t('attendance.present')}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.dangerText }}>{child.absent_count ?? 0}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.dangerText }}>{t('attendance.absent')}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.warningLight, borderRadius: radius.md, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.warningText }}>{child.late_count ?? 0}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.warningText }}>{t('attendance.late')}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.brandTint, borderRadius: radius.md, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.infoText }}>{child.excused_count ?? 0}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.infoText }}>{t('attendance.excused')}</Text>
                  </View>
                </View>

                {child.student_code && (
                  <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name="card" size={15} color={colors.textSecondary} outline style={{ marginEnd: 6 }} />
                    <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{t('child_settings.student_code')}: {child.student_code}</Text>
                  </View>
                )}

                <Button
                  title={t('reports.view_details')}
                  onPress={() => router.push(`/(parent)/child/${child.id}`)}
                  variant="primary"
                  style={{ marginTop: spacing.lg }}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
