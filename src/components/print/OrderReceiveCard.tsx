import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { OrderSection } from '@/components/print/OrderSection';

const MAX_REVIEW = 300;
const TAGS = ['tag_clear', 'tag_on_time', 'tag_packed', 'tag_price', 'tag_polite'] as const;

/** The review as its comma-separated pieces — a quick tag is on when it is one of them. */
const pieces = (s: string) => s.split(/[،,]/).map((x) => x.trim()).filter(Boolean);

/**
 * «استلمت الطباعة؟»: five big stars with the word for the chosen one under them, quick tags
 * that write themselves into the review (tap again to take one out), the review, confirm.
 */
export function OrderReceiveCard({ rating, onRating, review, onReview, onConfirm, busy }: {
  rating: number | null;
  onRating: (n: number) => void;
  review: string;
  onReview: (v: string) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const have = pieces(review);
  const toggle = (tag: string) => {
    if (have.includes(tag)) onReview(have.filter((x) => x !== tag).join('، '));
    else {
      const base = review.trim().replace(/[،,]\s*$/, '');
      onReview(((base ? `${base}، ` : '') + tag).slice(0, MAX_REVIEW));
    }
  };

  return (
    <OrderSection icon="success" title={t('print.receive_title')} hint={t('print.rate_hint')} tint={{ bg: colors.successLight, fg: colors.successText }}>
      <View style={{ alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.warningLight, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = rating != null && n <= rating;
            return (
              <TouchableOpacity key={n} onPress={() => onRating(n)} accessibilityRole="button" accessibilityLabel={`${n}/5`} accessibilityState={{ selected: rating === n }}
                hitSlop={4} activeOpacity={0.7} style={{ padding: 3 }}>
                <Icon name="star" outline={!on} size={42} color={on ? colors.warning : colors.warningText} style={{ opacity: on ? 1 : 0.35 }} />
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: rating ? 16 : 13, color: rating ? colors.warningText : colors.textSecondary, marginTop: 4 }}>
          {rating ? t(`print.rate_${rating}`) : t('print.rate_pick')}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm }}>
        {TAGS.map((k) => {
          const tag = t(`print.${k}`);
          const on = have.includes(tag);
          return (
            <TouchableOpacity key={k} onPress={() => toggle(tag)} accessibilityRole="button" accessibilityState={{ selected: on }} activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 34, borderRadius: radius.full,
                backgroundColor: on ? colors.successLight : colors.surfaceSunken, borderWidth: 1, borderColor: on ? colors.success : colors.border }}>
              <Icon name={on ? 'success' : 'add'} size={14} color={on ? colors.successText : colors.textSecondary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? colors.successText : colors.textSecondary }}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Input value={review} onChangeText={onReview} placeholder={t('print.review_ph')} maxLength={MAX_REVIEW} multiline />
      <Button title={t('print.confirm_receive')} onPress={onConfirm} loading={busy} variant="success" style={{ marginTop: spacing.md }} />
    </OrderSection>
  );
}

/** Rated already: the stars, the word, the teacher's own words as a quote. */
export function OrderRatedCard({ rating, review }: { rating: number; review: string | null }) {
  const { t } = useTranslation();
  const r = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <OrderSection icon="star" title={t('print.order_your_rating')} tint={{ bg: colors.warningLight, fg: colors.warningText }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.warningLight }}>
        <View style={{ flexDirection: 'row', gap: 1 }}>
          {[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" outline={n > rating} size={22} color={n <= rating ? colors.warning : colors.warningText} style={{ opacity: n <= rating ? 1 : 0.35 }} />)}
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.warningText }} numberOfLines={1}>{t(`print.rate_${r}`)}</Text>
      </View>
      {review ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <View style={{ width: 3, borderRadius: 2, backgroundColor: colors.accent }} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary }}>{review}</Text>
        </View>
      ) : null}
    </OrderSection>
  );
}
