import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useTeacherOnboarding, useMarkOnboardingStep } from '@/hooks/useTeacherOnboarding';

/**
 * Teacher Onboarding — Step 1 intro popup, mounted globally (like SurveyModal) so
 * it interrupts on first login. Shows only for a brand-new teacher (walkthrough
 * active, intro not yet seen, zero courses). Completing on an explicit action
 * (create / skip) — not on mere display — so an app closed with it open resumes
 * here next time. Writes the same server state the web dashboard reads.
 */
export function TeacherOnboardingModal() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: state } = useTeacherOnboarding();
  const mark = useMarkOnboardingStep();
  const [dismissed, setDismissed] = useState(false);

  const due = !!state && state.active && !state.steps.intro && !state.has_courses;
  const visible = due && !dismissed;

  const complete = () => {
    if (!mark.isPending) mark.mutate('intro');
    setDismissed(true);
  };

  const goCreate = () => {
    complete();
    router.push('/(teacher)/courses/create');
  };

  if (!due) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={complete}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + spacing.lg }}>
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
              <Icon name="book" size={28} color={colors.brand} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, textAlign: 'right' }}>
              {t('onboarding.intro_title')}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'right', marginTop: spacing.sm }}>
              {t('onboarding.intro_body')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
            <TouchableOpacity onPress={complete} style={{ flex: 1, minHeight: 50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary }}>{t('onboarding.skip')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goCreate} style={{ flex: 2, minHeight: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, flexDirection: 'row', gap: spacing.sm }}>
              <Icon name="add" size={18} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('onboarding.create_course')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
