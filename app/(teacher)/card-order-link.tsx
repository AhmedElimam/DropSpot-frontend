import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Share, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { mintCardOrderLink, type MintedCardOrderLink } from '@/api/students';

/**
 * Card-order PORTAL link (mobile parity for the web card-orders.generate channel):
 * the teacher mints a single-use link and shares it with a not-yet-enrolled family,
 * who fill the card order with no OTP. It lands in the super-admin review queue.
 * No inputs — the link is generic; the family provides the student/parent details.
 */
export default function CardOrderLinkScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [minted, setMinted] = useState<MintedCardOrderLink | null>(null);

  const mint = async () => {
    setBusy(true);
    try {
      const res = await mintCardOrderLink();
      setMinted(res);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('card_order_link.failed'));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!minted) return;
    try { await Share.share({ message: `${t('card_order_link.share_prefix')}\n${minted.url}` }); } catch { /* dismissed */ }
  };

  const card = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Icon name="forward" size={22} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('card_order_link.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.lg }}>
          {t('card_order_link.intro')}
        </Text>

        {minted ? (
          <View style={card}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.success, marginBottom: spacing.xs }}>{t('card_order_link.ready')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              {t('card_order_link.ready_hint')}
            </Text>
            <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }} selectable>{minted.url}</Text>
            </View>
            <TouchableOpacity onPress={share} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md }}>
              <Icon name="forward" size={18} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('card_order_link.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMinted(null)} activeOpacity={0.85} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('card_order_link.another')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={card}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="card" size={22} color={colors.brand} />
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                  {t('card_order_link.how')}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={mint} disabled={busy} activeOpacity={0.85} style={{ opacity: busy ? 0.6 : 1, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Icon name="add" size={20} color="#fff" />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('card_order_link.mint')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}
