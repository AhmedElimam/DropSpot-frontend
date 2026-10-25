import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Button } from '@/components/ui/Button';
import { RosePortrait } from '@/components/rose/RoseStamp';
import { useAuthStore } from '@/stores/authStore';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { SUPPORT_PHONE } from '@/config/support';
import { formatNumber } from '@/utils/format';

/**
 * The soft lock's paywall (founder 2026-10-25), in مدام روز's voice: the free period is
 * over, the app keeps working, adding students waits for the subscription. Shown inside
 * the add-student sheet in place of the four doors. Two ways out: WhatsApp to the
 * management, or the subscription screen with the bill and where to pay.
 */
export function EnrollLockedPaywall({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const prices = useAuthStore((s) => s.user?.subscription?.prices);
  const contact = useAppConfigStore((s) => s.config.contact);
  const phone = (contact?.support_phone || SUPPORT_PHONE).replace(/\D+/g, '');
  const n = (v: number | undefined) => formatNumber(Number(v ?? 0), { maximumFractionDigits: 0 });
  const whatsapp = () => {
    const text = encodeURIComponent('السلام عليكم، أريد تفعيل اشتراك دروس سبوت.');
    void Linking.openURL(`https://wa.me/2${phone}?text=${text}`);
  };
  const subscribe = () => { onClose(); setTimeout(() => router.push('/(teacher)/subscription' as Href), 60); };

  return (
    <View style={{ alignItems: 'center' }}>
      <RosePortrait size={96} large />
      <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.md }}>{t('subscription.locked_title')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>{t('subscription.locked_body')}</Text>
      {prices ? (
        <View style={{ marginTop: spacing.md, backgroundColor: colors.brandTint, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('subscription.locked_price', { term: n(prices.term), year: n(prices.year) })}</Text>
        </View>
      ) : null}
      <View style={{ width: '100%', marginTop: spacing.lg, gap: spacing.sm }}>
        <Button title={t('subscription.locked_whatsapp')} onPress={whatsapp} />
        <Button title={t('subscription.locked_subscribe')} variant="outline" onPress={subscribe} />
        <TouchableOpacity onPress={onClose} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textTertiary }}>{t('subscription.locked_later')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
