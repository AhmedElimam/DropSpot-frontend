import { memo, useState } from 'react';
import { View, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { useBetaFeature } from '@/hooks/useBetaFeature';
import { BetaFeedbackSheet } from '@/components/ui/BetaFeedbackSheet';
import { BETA_GOLD, BETA_INK } from '@/components/ui/betaTokens';

/**
 * «تجريبي» — the marks a feature carries while this person has it only through beta
 * targeting (feature-targeting contract 2026-10-15). Gold on purpose: the one colour the
 * palette keeps for «special» (the distinguished-member badge), legible on the ink hero
 * and on paper alike, in both schemes. Nothing here changes when a feature is released to
 * everyone — the server drops the key from `feature_beta` and both components render null.
 *
 * `feature` gates the component on its own; omit it inside a block that is already gated.
 * RTL: 'row' only (never 'row-reverse').
 */
export { BETA_GOLD, BETA_INK };

const CHIP_TEST_ID = 'beta-chip';
const LINE_TEST_ID = 'beta-line';

function Chip({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  return (
    <View
      testID={CHIP_TEST_ID}
      accessibilityLabel={t('beta.chip_a11y')}
      style={[{ alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, backgroundColor: BETA_GOLD }, style]}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 10, lineHeight: 14, color: BETA_INK }}>{t('beta.chip')}</Text>
    </View>
  );
}

/** Small gold «تجريبي». With `feature`, drawn only while that key is in `feature_beta`. */
export const BetaChip = memo(function BetaChip({ feature, style }: { feature?: string; style?: StyleProp<ViewStyle> }) {
  const beta = useBetaFeature(feature ?? '');
  if (feature && !beta) return null;
  return <Chip style={style} />;
});

/**
 * «نسخة تجريبية — رأيك يهمّنا»: ONE quiet line at the END of a beta feature's screen, after the
 * content (founder 2026-10-28: the boxed line on the hero seam, above the content, was in the
 * way — the feature itself comes first, the note at the bottom). Tapping it opens the feedback
 * sheet right there (BetaFeedbackSheet), for every role: the note goes to the platform's /ops
 * queue and the reply comes back in «مراسلة الإدارة». It used to open the teacher's tickets
 * screen — the parents' channel, where nothing reaches the platform (founder 2026-10-19).
 *
 * A super-admin wearing the account sees the chip alone: a note would go out in the
 * teacher's name.
 */
export const BetaLine = memo(function BetaLine({ feature, style }: { feature?: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const beta = useBetaFeature(feature ?? '');
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const [open, setOpen] = useState(false);
  if (feature && !beta) return null;
  if (!feature || impersonating) {
    return <View testID={LINE_TEST_ID} style={[{ alignItems: 'center', paddingVertical: spacing.md }, style]}><Chip /></View>;
  }
  return (
    <>
      <TouchableOpacity
        testID={LINE_TEST_ID}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('beta.line')}
        accessibilityHint={t('beta.line_hint')}
        style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.xs, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg }, style]}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.textTertiary }}>{t('beta.line')}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 18, color: colors.primary }}>{t('beta.line_cta')}</Text>
        {/* RTL: a row's disclosure points LEFT (`back` → chevron-back). */}
        <Icon name="back" size={13} color={colors.primary} />
      </TouchableOpacity>
      <BetaFeedbackSheet feature={feature} visible={open} onClose={() => setOpen(false)} />
    </>
  );
});
