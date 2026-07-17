import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import client from '@/api/client';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/layout/Avatar';
import { Button } from '@/components/ui/Button';
import { getFriendlyErrorMessage } from '@/utils/errors';

export default function TeacherManagement() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: children } = useChildren();
  const queryClient = useQueryClient();
  const [removingTeacherId, setRemovingTeacherId] = useState<number | null>(null);

  const child = (children ?? []).find((c) => c.id === id);
  const teachers = child?.teachers ?? [];

  const removeMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      const { data } = await client.post('/parents/remove-teacher', {
        student_id: child ? child.student_id : Number(id),
        teacher_id: teacherId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      setRemovingTeacherId(null);
    },
    onError: (error) => {
      setRemovingTeacherId(null);
      Alert.alert(t('common.error'), getFriendlyErrorMessage(error));
    },
  });

  const handleRemove = (teacherId: number, teacherName: string) => {
    Alert.alert(
      t('parent.confirm_remove_title'),
      t('parent.confirm_remove_desc', { name: teacherName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('parent.remove'),
          style: 'destructive',
          onPress: () => {
            setRemovingTeacherId(teacherId);
            removeMutation.mutate(teacherId);
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginEnd: spacing.md }}>
              <Icon name="forward" size={26} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>
                {t('parent.manage_teachers')}
              </Text>
              {child && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
                  {child.name}
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {!teachers.length ? (
            <EmptyState icon="teacher" title={t('parent.no_teachers')} />
          ) : (
            teachers.map((teacher) => {
              const isRemoving = removingTeacherId === Number(teacher.id);
              return (
                <View
                  key={teacher.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.xxl,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: spacing.lg,
                    ...shadows.sm,
                    opacity: isRemoving ? 0.5 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Avatar name={teacher.name} size={48} />
                    <View style={{ flex: 1, marginStart: spacing.md }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>
                        {teacher.name}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, marginTop: 2 }}>
                        {t('parent.teacher_subscribed')}
                      </Text>
                    </View>
                    {isRemoving ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleRemove(Number(teacher.id), teacher.name)}
                        activeOpacity={0.7}
                        style={{
                          backgroundColor: colors.dangerLight,
                          borderRadius: radius.md,
                          minHeight: 48,
                          justifyContent: 'center',
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.lg,
                        }}
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.dangerText }}>
                          {t('parent.remove')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Button
                    variant="outline"
                    title={t('profile.contact_support')}
                    onPress={() => router.push('/(parent)/tickets')}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
