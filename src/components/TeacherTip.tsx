import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTeacherOnboarding, useMarkOnboardingStep } from '@/hooks/useTeacherOnboarding';
import type { OnboardingTip } from '@/api/onboarding';

interface TeacherTipProps {
  tip: OnboardingTip;
  icon: IconName;
  /** i18n key for the title. */
  titleKey: string;
  /** i18n key for the intro paragraph. */
  bodyKey: string;
  /** Optional i18n keys, each rendered as a bullet line. */
  bulletKeys?: string[];
  /** Optional secondary action (e.g. "set up payment method"). Marks seen, then runs. */
  cta?: { labelKey: string; icon?: IconName; onPress: () => void };
}

/**
 * A one-time contextual onboarding tip. Fires the first time a teacher reaches the
 * screen it's mounted on — independently of the other tips and of the mandatory
 * 3-step walkthrough. Dismissing (or tapping the CTA) marks it seen server-side, so
 * it stays dismissed and is shared with the web dashboard. Suppressed while the
 * blocking walkthrough is still active so it never stacks on the intro popup.
 */
export function TeacherTip({ tip, icon, titleKey, bodyKey, bulletKeys, cta }: TeacherTipProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: state } = useTeacherOnboarding();
  const mark = useMarkOnboardingStep();
  const [dismissed, setDismissed] = useState(false);

  const due = !!state && !state.active && state.tips?.[tip] === false;
  const visible = due && !dismissed;

  const complete = () => {
    if (!mark.isPending) mark.mutate(tip);
    setDismissed(true);
  };

  const goCta = () => {
    complete();
    cta?.onPress();
  };

  if (!due) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={complete}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
              <Icon name={icon} size={28} color={colors.brand} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, textAlign: 'right' }}>
              {t(titleKey)}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'right', marginTop: spacing.sm }}>
              {t(bodyKey)}
            </Text>

            {bulletKeys?.map((k) => (
              <View key={k} style={{ flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.md, alignItems: 'flex-start' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 9 }} />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'right' }}>
                  {t(k)}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
            <TouchableOpacity onPress={complete} style={{ flex: cta ? 1 : undefined, minWidth: cta ? undefined : '100%', minHeight: 50, borderRadius: radius.lg, borderWidth: cta ? 1 : 0, borderColor: colors.border, backgroundColor: cta ? 'transparent' : colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: cta ? fonts.medium : fonts.bold, fontSize: cta ? 15 : 16, color: cta ? colors.textSecondary : '#fff' }}>
                {t('onboarding.got_it')}
              </Text>
            </TouchableOpacity>
            {cta && (
              <TouchableOpacity onPress={goCta} style={{ flex: 2, minHeight: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, flexDirection: 'row', gap: spacing.sm }}>
                {cta.icon && <Icon name={cta.icon} size={18} color="#fff" />}
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t(cta.labelKey)}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
