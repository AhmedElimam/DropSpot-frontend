import { memo } from 'react';
import { View, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { useBetaFeature } from '@/hooks/useBetaFeature';

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
export const BETA_GOLD = '#F5C542';
export const BETA_INK = '#3B2A06';

/** Where a teacher (or assistant) sends their notes about a beta: the tickets channel. */
export const BETA_FEEDBACK_ROUTE = '/(teacher)/tickets' as Href;

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
 * One calm line under a beta feature's hero: «نسخة تجريبية — رأيك يهمّنا». A teacher or an
 * assistant taps it to open the tickets screen (the feedback channel that already exists);
 * a student or a parent gets the chip alone — they have no ticket channel to the platform.
 */
export const BetaLine = memo(function BetaLine({ feature, style }: { feature?: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const beta = useBetaFeature(feature ?? '');
  const role = useAuthStore((s) => s.role);
  if (feature && !beta) return null;
  const staff = role === 'teacher' || role === 'assistant';
  if (!staff) {
    return <View testID={LINE_TEST_ID} style={[{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }, style]}><Chip /></View>;
  }
  return (
    <TouchableOpacity
      testID={LINE_TEST_ID}
      onPress={() => router.push(BETA_FEEDBACK_ROUTE)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('beta.line')}
      accessibilityHint={t('beta.line_hint')}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: BETA_GOLD }, style]}
    >
      <Chip />
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.textSecondary }} numberOfLines={2}>{t('beta.line')}</Text>
      {/* RTL: a row's disclosure points LEFT (`back` → chevron-back). */}
      <Icon name="back" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
});
