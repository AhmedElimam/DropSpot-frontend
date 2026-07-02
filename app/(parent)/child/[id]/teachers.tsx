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
import { colors, spacing, radius, textPresets, shadows, nav } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import client from '@/api/client';

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
        student_id: Number(id),
        teacher_id: teacherId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      setRemovingTeacherId(null);
    },
    onError: () => {
      setRemovingTeacherId(null);
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
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1E1B4B', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginEnd: spacing.md }}>
              <Text style={{ fontSize: 24, color: '#fff' }}>{'←'}</Text>
            </TouchableOpacity>
            <View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>
                {t('parent.manage_teachers')}
              </Text>
              {child && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                  {child.name}
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {!teachers.length ? (
            <View style={{ alignItems: 'center', padding: spacing.xl4 }}>
              <Text style={{ fontSize: 48, marginBottom: spacing.md }}>{'👨‍🏫'}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                {t('parent.no_teachers')}
              </Text>
            </View>
          ) : (
            teachers.map((teacher) => {
              const isRemoving = removingTeacherId === Number(teacher.id);
              return (
                <View
                  key={teacher.id}
                  style={{
                    backgroundColor: colors.white,
                    borderRadius: radius.xl,
                    padding: spacing.lg,
                    ...shadows.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    opacity: isRemoving ? 0.5 : 1,
                  }}
                >
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginEnd: spacing.md,
                    }}
                  >
                    <Text style={{ fontSize: 20, color: '#fff' }}>{teacher.name[0]}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>
                      {teacher.name}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
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
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>
                        {t('parent.remove')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
