import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { HOMEWORK_RATINGS, normalizeRating, type HomeworkRating, type HomeworkSummary } from '@/api/homework';

/**
 * One meaning per grade, a *Light tint under its *Text ink: جيد green, مقبول amber, ضعيف red,
 * لم يحلّ a dark neutral — not a quality at all, the work was not there.
 */
export const RATING_TONE = (): Record<HomeworkRating, { bg: string; fg: string; ink: string; icon: IconName }> => ({
  good: { bg: colors.successLight, fg: colors.success, ink: colors.successText, icon: 'success' },
  acceptable: { bg: colors.warningLight, fg: colors.warning, ink: colors.warningText, icon: 'info' },
  weak: { bg: colors.dangerLight, fg: colors.danger, ink: colors.dangerText, icon: 'warning' },
  missing: { bg: colors.border, fg: colors.inkSoft, ink: colors.textPrimary, icon: 'absent' },
});

/** The grade a family reads on a homework; «لم يُصحَّح بعد» until the next session grades it. */
export function HomeworkRatingBadge({ rating, big = false }: { rating: HomeworkRating | null; big?: boolean }) {
  const { t } = useTranslation();
  const r = normalizeRating(rating);
  const tone = r ? RATING_TONE()[r] : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: radius.full, paddingVertical: big ? 5 : 3, paddingHorizontal: big ? spacing.md : 10, backgroundColor: tone?.bg ?? colors.surfaceSunken }}>
      <Icon name={tone?.icon ?? 'clock'} size={big ? 16 : 13} color={tone?.ink ?? colors.textSecondary} />
      <Text style={{ fontFamily: fonts.bold, fontSize: big ? 14 : 12, color: tone?.ink ?? colors.textSecondary }}>{t(r ? `homework.rating.${r}` : 'homework.rating.ungraded')}</Text>
    </View>
  );
}

/**
 * The teacher's four chips on a roster row. Tapping a grade sets it; tapping the lit one
 * clears it (back to ungraded). Compact for a 360dp phone — short words, tight padding — and
 * they wrap rather than squeeze when the font is scaled up.
 */
export function HomeworkRateChips({ value, onChange, disabled = false }: {
  value: HomeworkRating | null;
  onChange: (rating: HomeworkRating | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const current = normalizeRating(value);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
      {HOMEWORK_RATINGS.map((r) => {
        const on = current === r;
        const tone = RATING_TONE()[r];
        return (
          <TouchableOpacity key={r} onPress={() => onChange(on ? null : r)} disabled={disabled} hitSlop={4} activeOpacity={0.85}
            accessibilityRole="button" accessibilityState={{ selected: on, disabled }}
            style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: radius.full, paddingHorizontal: 8, backgroundColor: on ? tone.bg : colors.surface, borderWidth: 1, borderColor: on ? tone.fg : colors.border }}>
            {on ? <Icon name={tone.icon} size={12} color={tone.ink} /> : null}
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? tone.ink : colors.textSecondary }}>{t(`homework.rating.${r}`)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * The completion rate on one line, the four counts under it — five tiles in one row would
 * not fit a small phone.
 */
export function HomeworkSummaryRow({ summary }: { summary: HomeworkSummary }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandTint, borderRadius: radius.lg, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: colors.brand }}>{summary.rate != null ? `${formatNumber(summary.rate)}٪` : '—'}</Text>
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('homework.rate_label')}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {HOMEWORK_RATINGS.map((r) => {
          const tone = RATING_TONE()[r];
          return (
            <View key={r} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tone.bg, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: tone.ink }}>{formatNumber(summary[r] ?? 0)}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tone.ink }} numberOfLines={1}>{t(`homework.rating.${r}`)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** «لم يحلّ N مرات متتالية» — shown from the second miss in a row; nothing below that. */
export function HomeworkStreakBadge({ n, big = false }: { n: number | null | undefined; big?: boolean }) {
  const { t } = useTranslation();
  if (!n || n < 2) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: big ? spacing.sm : 3, alignSelf: big ? 'stretch' : 'flex-start', backgroundColor: colors.dangerLight, borderRadius: big ? radius.lg : radius.full, paddingVertical: big ? spacing.sm : 2, paddingHorizontal: big ? spacing.md : 8 }}>
      <Icon name="warning" size={big ? 18 : 11} color={colors.dangerText} />
      <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: big ? 14 : 11, color: colors.dangerText }}>{n === 2 ? t('homework.missed_streak_two') : t('homework.missed_streak', { n: formatNumber(n) })}</Text>
    </View>
  );
}
