import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { ShopLogo } from '@/components/print/ShopLogo';
import { formatNumber } from '@/utils/format';
import { sampleSource, type MarketShop } from '@/api/print';

export const SHOP_CARD_WIDTH = 260;
const COVER = 132;

/**
 * A shop in the tab's strip, Talabat-style: its own work as the cover with open/closed on it,
 * the logo riding the photo's edge, then name, the decision line (★ rating (count) | hours |
 * km) and the price a page starts from. Tap → the shop's page.
 */
export function PrintTabShopCard({ s }: { s: MarketShop }) {
  const { t } = useTranslation();
  const paused = !!s.paused_until && new Date(s.paused_until).getTime() > Date.now();
  const state = paused ? { text: t('print.paused_tag'), bg: 'rgba(10,14,39,0.78)' }
    : s.open_now === true ? { text: t('print.open_now'), bg: 'rgba(31,147,102,0.94)' }
    : s.open_now === false ? { text: t('print.closed_now'), bg: 'rgba(10,14,39,0.72)' } : null;
  const price = s.price_from.bw ?? s.price_from.color;
  // A thin bar, not «·»: beside Arabic digits a middle dot reads as a zero (٠).
  const bar = <View style={{ width: 1, height: 12, backgroundColor: colors.border }} />;

  return (
    <TouchableOpacity onPress={() => router.push(`/(teacher)/print/shops/${s.vendor_id}` as Href)} activeOpacity={0.9} accessibilityRole="button"
      style={{ width: SHOP_CARD_WIDTH, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', opacity: paused ? 0.82 : 1 }}>
      <View style={{ height: COVER }}>
        {s.cover ? (
          <Image source={sampleSource(s.cover.url)} style={{ width: '100%', height: '100%', backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={150} recyclingKey={String(s.cover.id)} />
        ) : (
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="print" size={40} color="rgba(255,255,255,0.55)" />
          </LinearGradient>
        )}
        <LinearGradient pointerEvents="none" colors={['rgba(10,14,39,0)', 'rgba(10,14,39,0.4)']} style={{ position: 'absolute', start: 0, end: 0, bottom: 0, height: 56 }} />
        {state ? (
          <View style={{ position: 'absolute', top: 10, start: 10, flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: state.bg }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', opacity: s.open_now === true && !paused ? 1 : 0.6 }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{state.text}</Text>
          </View>
        ) : null}
        {(s.samples_count ?? 0) > 1 ? (
          <View style={{ position: 'absolute', bottom: 8, end: 10, flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: 'rgba(10,14,39,0.62)' }}>
            <Icon name="images" size={11} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#fff' }}>{formatNumber(s.samples_count ?? 0)}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <ShopLogo logo={s.logo} size={52} premium={s.quality_tier === 'premium'} ring style={{ marginTop: -26, ...shadows.sm }} />
          <View style={{ flex: 1, paddingTop: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
            {s.city ? <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }} numberOfLines={1}>{s.city}</Text> : null}
          </View>
        </View>

        {/* ★ rating (count) | hours | km */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
          {s.rating != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name="star" size={13} color={colors.warning} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>{formatNumber(s.rating, { maximumFractionDigits: 1 })}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }}>({formatNumber(s.ratings)})</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: colors.accentLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.accentText }}>{t('print.new_shop_short')}</Text>
            </View>
          )}
          {bar}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="clock" size={13} color={s.speed_measured ? colors.success : colors.textTertiary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: s.speed_measured ? colors.successText : colors.textSecondary }}>{t('print.hours_short', { h: formatNumber(s.speed_hours) })}</Text>
          </View>
          {s.distance_km != null ? (
            <>
              {bar}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Icon name="location" size={13} color={colors.textTertiary} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('print.km_away', { km: formatNumber(s.distance_km, { maximumFractionDigits: 1 }) })}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.sm }} />

        {/* delivery or pickup, and the price a page starts from */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: s.delivery ? colors.accentLight : colors.surfaceSunken, flexShrink: 1 }}>
            <Icon name={s.delivery ? 'delivery' : 'storefront'} size={12} color={s.delivery ? colors.accentText : colors.textSecondary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: s.delivery ? colors.accentText : colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>
              {s.delivery
                ? (s.delivery_fee > 0 ? t('print.delivery_chip', { p: formatNumber(s.delivery_fee, { maximumFractionDigits: 2 }) }) : t('print.free_delivery'))
                : t('print.pickup_chip')}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          {price != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{t('print.from')}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{formatNumber(price, { maximumFractionDigits: 2 })}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{s.price_from.bw != null ? t('print.egp_page') : t('print.color_short')}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
