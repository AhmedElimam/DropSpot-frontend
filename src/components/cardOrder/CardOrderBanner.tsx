import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { getCardOrderTargets } from '@/api/cardOrders';
import { useCardOrderDismiss } from '@/stores/cardOrderDismiss';

/**
 * Homepage "no card yet" conversion banner (student + parent). Shows only for
 * students/children who don't have a card and can order one; names the specific
 * child(ren) on the parent side. Routes into the existing order screen (pre-selecting
 * the child when there's exactly one). Session-only dismissal — reappears next launch.
 */
export function CardOrderBanner({ scope }: { scope: 'student' | 'parent' }) {
  const { t } = useTranslation();
  const isDismissed = useCardOrderDismiss((s) => s.isDismissed(scope));
  const dismiss = useCardOrderDismiss((s) => s.dismiss);

  const { data } = useQuery({
    queryKey: ['card-order-targets'],
    queryFn: getCardOrderTargets,
    staleTime: 60_000,
  });

  if (isDismissed) return null;

  // Orderable = lacks a card, has a teacher context, and no order already in flight.
  const orderable = (data ?? []).filter((tgt) => tgt.can_order && !tgt.pending_review);
  if (orderable.length === 0) return null;

  const one = orderable.length === 1 ? orderable[0] : null;
  const title =
    scope === 'student'
      ? t('card_order.banner_title_student')
      : one
        ? t('card_order.banner_title_parent_one', { name: one.name })
        : t('card_order.banner_title_parent_many', { names: orderable.map((tgt) => tgt.name).join('، ') });

  const goOrder = () => {
    const base = scope === 'student' ? '/(student)/order-card' : '/(parent)/order-card';
    // Pre-select when there's exactly one target; otherwise the screen lets them pick.
    const href = (one ? `${base}?studentId=${one.student_id}` : base) as Href;
    router.push(href);
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.card,
        padding: 15,
        ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.brandWash, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="card" size={18} color={colors.brand} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 2 }}>
            {t('card_order.banner_body')}
          </Text>
        </View>
        <TouchableOpacity onPress={() => dismiss(scope)} hitSlop={10} accessibilityLabel={t('common.close')}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.faint }}>✕</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={goOrder}
        activeOpacity={0.85}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          marginTop: spacing.md,
          height: 44,
          backgroundColor: colors.brand,
          borderRadius: 15,
        }}
      >
        <Icon name="card" size={16} color="#fff" />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('card_order.banner_cta')}</Text>
      </TouchableOpacity>
    </View>
  );
}
