import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients, control } from '@/theme/index';
import { Avatar } from '@/components/layout/Avatar';
import { useChildren } from '@/hooks/useChildren';
import { createTicket } from '@/api/tickets';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SuccessConfirmation } from '@/components/ui/SuccessConfirmation';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';

export default function CreateTicket() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: children } = useChildren();

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const selectedChild = (children ?? []).find((c) => c.id === selectedChildId);
  const selectedTeacher = selectedChild?.teachers?.find((tc) => Number(tc.id) === selectedTeacherId);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      createTicket({
        student_id: Number(selectedChild!.student_id),
        teacher_id: selectedTeacherId!,
        subject,
        description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const isValid = selectedChildId && selectedTeacherId && subject.trim() && description.trim();

  const handleSubmit = () => {
    if (!isValid || createMutation.isPending) return;
    createMutation.mutate();
  };

  const handleSelectChild = (childId: string) => {
    if (selectedChildId === childId) {
      setSelectedChildId(null);
      setSelectedTeacherId(null);
    } else {
      setSelectedChildId(childId);
      setSelectedTeacherId(null);
    }
  };

  if (createMutation.isSuccess) {
    return (
      <SuccessConfirmation
        title={t('tickets.created_success')}
        message={t('tickets.created_success_desc')}
        onDone={() => router.back()}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.xl4 + insets.top,
              paddingBottom: spacing.xl4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => router.back()} style={{ marginEnd: spacing.md }}>
                <Icon name="forward" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>
                {t('tickets.create')}
              </Text>
            </View>
          </LinearGradient>

          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            {/* Student + Teacher selection */}
            <View style={{ gap: spacing.md }}>
              <Text style={textPresets.label}>{t('tickets.select_child')}</Text>
              {(children ?? []).map((child) => {
                const isSelected = selectedChildId === child.id;
                return (
                  <View
                    key={child.id}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: radius.xl,
                      overflow: 'hidden',
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.brand : colors.border,
                      ...shadows.sm,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => handleSelectChild(child.id)}
                      activeOpacity={0.7}
                      style={{
                        padding: spacing.lg,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ marginEnd: spacing.md }}>
                          <Avatar name={child.name} size={44} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>
                            {child.name}
                          </Text>
                          {child.grade && (
                            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                              {child.grade}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Icon name={isSelected ? 'down' : 'back'} size={18} color={isSelected ? colors.primary : colors.textTertiary} />
                    </TouchableOpacity>

                    {isSelected && (
                      <View
                        style={{
                          paddingHorizontal: spacing.lg,
                          paddingBottom: spacing.lg,
                          gap: spacing.sm,
                        }}
                      >
                        <View
                          style={{
                            height: 1,
                            backgroundColor: colors.borderLight,
                            marginBottom: spacing.sm,
                          }}
                        />
                        {!child.teachers?.length ? (
                          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.sm }}>
                            {t('tickets.no_teachers')}
                          </Text>
                        ) : (
                          <>
                            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>
                              {t('tickets.select_teacher')}
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                              {child.teachers.map((teacher) => (
                                <TouchableOpacity
                                  key={teacher.id}
                                  onPress={() => setSelectedTeacherId(Number(teacher.id))}
                                  activeOpacity={0.7}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: spacing.sm,
                                    paddingHorizontal: spacing.md,
                                    borderRadius: radius.md,
                                    minHeight: 44,
                                    backgroundColor:
                                      selectedTeacherId === Number(teacher.id)
                                        ? colors.brandTint
                                        : colors.surfaceSunken,
                                    borderWidth: 1.5,
                                    borderColor:
                                      selectedTeacherId === Number(teacher.id)
                                        ? colors.brand
                                        : colors.border,
                                  }}
                                >
                                  <Icon name="teacher" size={16} color={colors.textSecondary} outline style={{ marginEnd: spacing.xs }} />
                                  <Text
                                    style={{
                                      fontFamily: fonts.medium,
                                      fontSize: 14,
                                      color:
                                        selectedTeacherId === Number(teacher.id)
                                          ? colors.brand
                                          : colors.textPrimary,
                                    }}
                                  >
                                    {teacher.name}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Subject */}
            {selectedChild && (
              <View>
                <Text style={[textPresets.label, { marginBottom: spacing.sm }]}>{t('tickets.subject')}</Text>
                <TextInput
                  value={subject}
                  onChangeText={setSubject}
                  placeholder={t('tickets.subject_placeholder')}
                  placeholderTextColor={colors.textTertiary}
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 17,
                    minHeight: control.minHeight,
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: radius.lg,
                    padding: 16,
                    color: colors.textPrimary,
                    textAlign: 'right',
                    borderWidth: 1.5,
                    borderColor: subject ? colors.brand : colors.borderStrong,
                  }}
                />
              </View>
            )}

            {/* Description */}
            {selectedChild && (
              <View>
                <Text style={[textPresets.label, { marginBottom: spacing.sm }]}>{t('tickets.description')}</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('tickets.description_placeholder')}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={5}
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 17,
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: radius.lg,
                    padding: 16,
                    color: colors.textPrimary,
                    textAlign: 'right',
                    minHeight: 120,
                    borderWidth: 1.5,
                    borderColor: description ? colors.brand : colors.borderStrong,
                  }}
                />
              </View>
            )}

            {/* Error feedback — calm, instructive, with a human fallback */}
            {createMutation.isError && (
              <View style={{ backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.dangerText }}>
                  {t('tickets.create_error')}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.dangerText }}>
                  {getFriendlyErrorMessage(createMutation.error)}
                </Text>
              </View>
            )}

            {/* Submit */}
            {selectedChild && (
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!isValid || createMutation.isPending}
                activeOpacity={0.85}
                style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: !isValid ? 0.5 : 1 }}
              >
                <LinearGradient
                  colors={gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ minHeight: control.minHeight, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}
                >
                  {createMutation.isPending ? (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>
                      {t('common.loading')}
                    </Text>
                  ) : (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: 1 }}>
                      {t('tickets.submit')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
