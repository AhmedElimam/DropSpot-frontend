import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import client from '@/api/client';
import { Avatar } from '@/components/layout/Avatar';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { getFriendlyErrorMessage } from '@/utils/errors';

/**
 * Top-level "Teacher Management" tab: every child grouped with the teachers
 * they're subscribed to, and a per-teacher remove action. Same functionality
 * that also lives inline in the child detail screen (kept as a shortcut) — no
 * new API, reuses /parents/remove-teacher.
 */
export default function TeacherManagement() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: children, isLoading } = useChildren();
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<number | null>(null);

  const removeMutation = useMutation({
    mutationFn: async ({ studentId, teacherId }: { studentId: number; teacherId: number }) => {
      const { data } = await client.post('/parents/remove-teacher', { student_id: studentId, teacher_id: teacherId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      setRemovingId(null);
    },
    onError: (error) => {
      setRemovingId(null);
      Alert.alert(t('common.error'), getFriendlyErrorMessage(error));
    },
  });

  const confirmRemove = (studentId: number, teacherId: number, teacherName: string) => {
    Alert.alert(
      t('parent.confirm_remove_title'),
      t('parent.confirm_remove_desc', { name: teacherName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('parent.remove'),
          style: 'destructive',
          onPress: () => {
            setRemovingId(teacherId);
            removeMutation.mutate({ studentId, teacherId });
          },
        },
      ],
    );
  };

  const list = children ?? [];
  const hasAnyTeacher = list.some((c) => (c.teachers?.length ?? 0) > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff' }}>{t('parent.manage_teachers')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            {t('parent.teachers')}
          </Text>
        </LinearGradient>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl4 }} />
        ) : !list.length ? (
          <EmptyState icon="children" title={t('parent.no_children')} />
        ) : !hasAnyTeacher ? (
          <EmptyState icon="teacher" title={t('parent.no_teachers')} />
        ) : (
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            {list.map((child) => (
              <View
                key={child.id}
                style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <Avatar name={child.name} size={44} />
                  <View style={{ marginStart: spacing.md, flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{child.name}</Text>
                    {child.grade ? <Text style={textPresets.bodySmall}>{child.grade}</Text> : null}
                  </View>
                </View>

                {!child.teachers?.length ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, paddingVertical: spacing.sm }}>
                    {t('parent.no_teachers')}
                  </Text>
                ) : (
                  child.teachers.map((teacher, i) => {
                    const isRemoving = removingId === Number(teacher.id);
                    return (
                      <View
                        key={teacher.id}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: spacing.md,
                          borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderLight,
                          opacity: isRemoving ? 0.5 : 1,
                        }}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                          <Icon name="teacher" size={20} color={colors.brand} />
                        </View>
                        <Text style={[textPresets.body, { flex: 1, fontFamily: fonts.medium }]}>{teacher.name}</Text>
                        {isRemoving ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <TouchableOpacity
                            onPress={() => confirmRemove(Number(child.student_id), Number(teacher.id), teacher.name)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t('parent.remove')}
                            style={{ minHeight: 44, justifyContent: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}
                          >
                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.dangerText }}>{t('parent.remove')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
