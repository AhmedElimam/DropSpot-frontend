import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { AppModal as Modal } from '@/ui/AppModal';
import { NazerFramed } from '@/components/nazer/NazerFramed';
import { formatNumber } from '@/utils/format';

/**
 * What the Dros Spot card is for (founder 2026-10-24: «what the card does… not bound to one
 * teacher or enrollment… no new one each year… the sticker on a teacher's door… sell it, but not
 * too hard»). Plain facts, calm words, no urgency: the same list on the order screen, in the
 * popup above it, and — in his words — in الناظر's tour.
 */
export const CARD_PERKS: { key: string; icon: IconName }[] = [
  { key: 'one', icon: 'card' },
  { key: 'years', icon: 'calendar' },
  { key: 'door', icon: 'scan' },
  { key: 'sticker', icon: 'success' },
  { key: 'parent', icon: 'children' },
];

/** The perks as quiet rows: an icon in a soft square, a title, one line. */
export function CardPerks({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: compact ? spacing.sm : spacing.md }}>
      {CARD_PERKS.map((p) => (
        <View key={p.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={p.icon} size={18} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.textPrimary }}>{t(`card_order.perk_${p.key}_title`)}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.textSecondary }}>{t(`card_order.perk_${p.key}_body`)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** «ليه محتاج كارت؟» on the card page: the record, the door, the backup. */
const WHY: { key: string; icon: IconName }[] = [
  { key: 'record', icon: 'success' },
  { key: 'fast', icon: 'scan' },
  { key: 'backup', icon: 'lock' },
];
export function CardWhy() {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.md }}>
      {WHY.map((w) => (
        <View key={w.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={w.icon} size={18} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.textPrimary }}>{t(`card_info.why_${w.key}_title`)}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.textSecondary }}>{t(`card_info.why_${w.key}_body`)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** «إزاي يوصلك؟»: order in the app, reviewed and printed, delivered to the address. */
const STEPS = ['order', 'review', 'deliver'] as const;
export function CardSteps() {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.md }}>
      {STEPS.map((s, i) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.onPrimary, includeFontPadding: false }}>{formatNumber(i + 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.textPrimary }}>{t(`card_info.how_${s}_title`)}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.textSecondary }}>{t(`card_info.how_${s}_body`)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The popup over the order screen: الناظر in his frame on the card's top edge (the app's popup
 * shape), the perks, «تمام، اطلب الكارت» to the form and «بعدين» to leave. Shown once per account
 * on this phone; the form keeps a link to open it again.
 */
export function CardIntroModal({ visible, onOrder, onLater }: { visible: boolean; onOrder: () => void; onLater: () => void }) {
  const { t } = useTranslation();
  const HEAD = 92;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onOrder}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.6)', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ paddingTop: HEAD / 2, maxHeight: '90%' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, paddingTop: HEAD / 2 + spacing.sm, ...shadows.md, flexShrink: 1 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: colors.textPrimary, textAlign: 'center' }}>{t('card_order.intro_title')}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textTertiary, textAlign: 'center', marginBottom: spacing.lg }}>{t('card_order.intro_sub')}</Text>
              <CardPerks />
              <TouchableOpacity onPress={onOrder} activeOpacity={0.85} accessibilityRole="button"
                style={{ marginTop: spacing.xl, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('card_order.intro_cta')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onLater} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('card_order.intro_later')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
            <NazerFramed size={HEAD} blink={false} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
