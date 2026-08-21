import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useMyTeachers, useSwitchTeacher } from '@/hooks/useMyTeachers';

/**
 * Persistent active-teacher indicator + switcher, for the Home header.
 *
 * Renders NOTHING for a plain teacher or a single-relationship assistant — the
 * common case stays byte-identical to before multi-teacher support. Only an
 * assistant who works for 2+ teachers sees the chip; tapping it opens the picker.
 */
export function TeacherSwitcher() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data } = useMyTeachers();
  const switchTeacher = useSwitchTeacher();
  const [open, setOpen] = useState(false);

  const teachers = data?.teachers ?? [];
  if (teachers.length <= 1) return null;

  const active = teachers.find((x) => x.is_active_context) ?? teachers[0];

  const pick = (teacherId: number) => {
    if (teacherId === active.teacher_id) { setOpen(false); return; }
    switchTeacher.mutate(teacherId, { onSuccess: () => setOpen(false) });
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: spacing.md, alignSelf: 'flex-start', marginTop: spacing.sm }}
      >
        <Icon name="teacher" size={14} color="#fff" />
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff', maxWidth: 180 }} numberOfLines={1}>{active.name ?? '—'}</Text>
        <Icon name="down" size={14} color="#fff" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: spacing.xl, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.xl, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('teacher.switch_teacher')}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}><Icon name="forward" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>{t('teacher.switch_teacher_hint')}</Text>
            <ScrollView>
              {teachers.map((tt) => {
                const isActive = tt.teacher_id === active.teacher_id;
                const busy = switchTeacher.isPending && switchTeacher.variables === tt.teacher_id;
                return (
                  <TouchableOpacity
                    key={tt.teacher_id}
                    onPress={() => pick(tt.teacher_id)}
                    disabled={switchTeacher.isPending}
                    activeOpacity={0.85}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: isActive ? colors.primaryLight : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: isActive ? colors.primary : colors.border, padding: spacing.lg, marginBottom: spacing.sm }}
                  >
                    <Icon name="teacher" size={20} color={isActive ? colors.primary : colors.textSecondary} />
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{tt.name ?? '—'}</Text>
                    {busy ? <ActivityIndicator size="small" color={colors.primary} /> : isActive ? <Icon name="success" size={20} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
