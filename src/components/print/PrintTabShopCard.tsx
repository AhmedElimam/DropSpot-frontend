import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ShopLogo } from '@/components/print/ShopLogo';
import { formatNumber } from '@/utils/format';
import { sampleSource, type MarketShop } from '@/api/print';
import type { StripChip } from '@/utils/printStrip';

export const SHOP_CARD_WIDTH = 260;
const COVER = 132;

// The marketplace ShopCard's ribbon tints and icons (shops/index.tsx), so a «الأرخص» reads
// the same on the tab as on the full list.
const RIBBON_TINT = (): Record<string, { bg: string; fg: string }> => ({
  cheapest: { bg: colors.successLight, fg: colors.successText },
  fastest: { bg: colors.brandTint, fg: colors.brand },
  nearest: { bg: colors.accentLight, fg: colors.accentText },
  top_rated: { bg: colors.warningLight, fg: colors.warningText },
});
const RIBBON_ICON: Record<string, IconName> = { cheapest: 'pricetag', fastest: 'flash', nearest: 'location', top_rated: 'ribbon' };

/** «مرة / مرتين / ٣ مرات / ١١ مرة» — Arabic counts its times by hand. */
export function usedLine(t: (k: string, o?: any) => string, n: number): string {
  if (n === 1) return t('print.strip_used_1');
  if (n === 2) return t('print.strip_used_2');
  return t(n <= 10 ? 'print.strip_used_few' : 'print.strip_used_many', { n: formatNumber(n) });
}

/**
 * A shop in the tab's strip, Talabat-style (founder 2026-10-14: «مطابع بشغلها needs some
 * love»): its own work as the cover with open/closed and its best-at ribbon on it, the logo
 * riding the photo's edge, then name, the decision line (★ rating (count) | hours | km), and
 * delivery-or-pickup beside the price a page starts from, as a pill. A shop she printed at
 * before wears «مطبعتك» and how many times; the fact the strip is sorted by is lit.
 */
export function PrintTabShopCard({ s, labels = {}, used = 0, focus = 'recommended' }: { s: MarketShop; labels?: Record<string, string>; used?: number; focus?: StripChip }) {
  const { t } = useTranslation();
  const paused = !!s.paused_until && new Date(s.paused_until).getTime() > Date.now();
  const state = paused ? { text: t('print.paused_tag'), bg: 'rgba(10,14,39,0.78)' }
    : s.open_now === true ? { text: t('print.open_now'), bg: 'rgba(31,147,102,0.94)' }
    : s.open_now === false ? { text: t('print.closed_now'), bg: 'rgba(10,14,39,0.72)' } : null;
  const price = s.price_from.bw ?? s.price_from.color;
  const ribbon = s.badges[0];
  const tint = ribbon ? RIBBON_TINT()[ribbon] : undefined;
  const mine = used > 0;
  // A thin bar, not «·»: beside Arabic digits a middle dot reads as a zero (٠).
  const bar = <View style={{ width: 1, height: 12, backgroundColor: colors.border }} />;
  const lit = (on: boolean) => (on ? { fontFamily: fonts.bold, color: colors.brand } : null);
  const priceLit = focus === 'cheapest';

  return (
    <TouchableOpacity onPress={() => router.push(`/(teacher)/print/shops/${s.vendor_id}` as Href)} activeOpacity={0.9} accessibilityRole="button"
      accessibilityLabel={[s.name, mine ? usedLine(t, used) : null].filter(Boolean).join('، ')}
      style={{ width: SHOP_CARD_WIDTH, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: mine ? 1.5 : 1, borderColor: mine ? colors.accent : colors.border, overflow: 'hidden', opacity: paused ? 0.82 : 1 }}>
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
        {/* what it is best at — «الأرخص», «الأسرع»… */}
        {ribbon ? (
          <View style={{ position: 'absolute', top: 10, end: 10, flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: tint?.bg ?? colors.surface, ...shadows.sm }}>
            <Icon name={RIBBON_ICON[ribbon] ?? 'trophy'} size={12} color={tint?.fg ?? colors.textPrimary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: tint?.fg ?? colors.textPrimary }}>{labels[ribbon] ?? t(`print.sort_${ribbon}`, { defaultValue: ribbon })}</Text>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
              {mine ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: colors.accent }}>
                  <Icon name="success" size={11} color={colors.onAccent} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.onAccent }}>{t('print.strip_mine')}</Text>
                </View>
              ) : null}
            </View>
            {mine ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.accentText, flexShrink: 0 }} numberOfLines={1}>{usedLine(t, used)}</Text>
                {s.city ? <>{bar}<Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary, flexShrink: 1 }} numberOfLines={1}>{s.city}</Text></> : null}
              </View>
            ) : s.city ? <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }} numberOfLines={1}>{s.city}</Text> : null}
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
            <Icon name={focus === 'fastest' ? 'flash' : 'clock'} size={13} color={focus === 'fastest' ? colors.brand : s.speed_measured ? colors.success : colors.textTertiary} />
            <Text style={[{ fontFamily: fonts.medium, fontSize: 12, color: s.speed_measured ? colors.successText : colors.textSecondary }, lit(focus === 'fastest')]}>{t('print.hours_short', { h: formatNumber(s.speed_hours) })}</Text>
          </View>
          {s.distance_km != null ? (
            <>
              {bar}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Icon name="location" size={13} color={focus === 'nearest' ? colors.brand : colors.textTertiary} />
                <Text style={[{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }, lit(focus === 'nearest')]}>{t('print.km_away', { km: formatNumber(s.distance_km, { maximumFractionDigits: 1 }) })}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.sm }} />

        {/* delivery or pickup, and the price a page starts from — as a pill */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 8, borderRadius: 13, backgroundColor: s.delivery ? colors.accentLight : colors.surfaceSunken, borderWidth: focus === 'delivery' && s.delivery ? 1 : 0, borderColor: colors.accent, flexShrink: 1 }}>
            <Icon name={s.delivery ? 'delivery' : 'storefront'} size={12} color={s.delivery ? colors.accentText : colors.textSecondary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: s.delivery ? colors.accentText : colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>
              {s.delivery
                ? (s.delivery_fee > 0 ? t('print.delivery_chip', { p: formatNumber(s.delivery_fee, { maximumFractionDigits: 2 }) }) : t('print.free_delivery'))
                : t('print.pickup_chip')}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          {price != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14, backgroundColor: priceLit ? colors.successLight : colors.brandTint }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: priceLit ? colors.successText : colors.brand }}>{t('print.from')}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: priceLit ? colors.successText : colors.brand }}>{formatNumber(price, { maximumFractionDigits: 2 })}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: priceLit ? colors.successText : colors.brand }}>{s.price_from.bw != null ? t('print.egp_page') : t('print.color_short')}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
