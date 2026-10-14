import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { PrintTabShopCard } from '@/components/print/PrintTabShopCard';
import { orderStrip, stripChips, stripSummary, usedByShop, type StripChip } from '@/utils/printStrip';
import { getPrintOptions, type MarketShop, type PrintJob } from '@/api/print';

const SHOWN = 8;
const CHIP_ICON: Record<StripChip, IconName> = { recommended: 'thumbUp', nearest: 'location', cheapest: 'pricetag', fastest: 'flash', delivery: 'delivery' };
const CHIP_LABEL: Record<StripChip, string> = { recommended: 'print.chip_recommended', nearest: 'print.sort_nearest', cheapest: 'print.sort_cheapest', fastest: 'print.sort_fastest', delivery: 'print.chip_delivery' };

/** «مطبعة واحدة / مطبعتين / ٥ مطابع / ١٢ مطبعة». */
function countLine(t: (k: string, o?: any) => string, n: number) {
  if (n === 1) return t('print.strip_count_1');
  if (n === 2) return t('print.strip_count_2');
  return t(n <= 10 ? 'print.strip_count_few' : 'print.strip_count_many', { n: formatNumber(n) });
}

/**
 * «مطابع بشغلها» on the print tab (founder 2026-10-14: «needs some love»), the way a delivery
 * app shows restaurants near you: a head with one soft line of facts (how many, the nearest,
 * how many deliver) and «عرض الكل»; quick chips that re-order the strip on the phone
 * (مقترحة / الأقرب / الأرخص / الأسرع / توصيل — only those the data can honour); the cards,
 * the shops she already prints at first; and at the end, an ink tile to the full map.
 */
export function PrintTabShopsStrip({ shops, jobs, onAll }: { shops: MarketShop[]; jobs: PrintJob[]; onAll: () => void }) {
  const { t } = useTranslation();
  const options = useQuery({ queryKey: ['print-options'], queryFn: getPrintOptions });
  const labels = options.data?.badges ?? {};
  const [chip, setChip] = useState<StripChip>('recommended');

  const used = useMemo(() => usedByShop(jobs), [jobs]);
  const chips = useMemo(() => stripChips(shops), [shops]);
  const sum = useMemo(() => stripSummary(shops), [shops]);
  // A chip the data no longer honours (pull-to-refresh changed the list) falls back to «مقترحة».
  const active: StripChip = chips.includes(chip) ? chip : 'recommended';
  const shown = useMemo(() => orderStrip(shops, active, used).slice(0, SHOWN), [shops, active, used]);

  // The soft line under the title: count, then the nearest (or how many are open), then delivery.
  type Fact = { k: string; icon: IconName; text: string; tone?: string };
  const facts = ([
    { k: 'n', icon: 'storefront', text: countLine(t, sum.count) },
    sum.nearestKm != null
      ? { k: 'km', icon: 'location', text: t('print.strip_nearest', { km: formatNumber(sum.nearestKm, { maximumFractionDigits: 1 }) }) }
      : sum.openNow > 0 ? { k: 'open', icon: 'clock', text: t('print.strip_open_now', { n: formatNumber(sum.openNow) }), tone: colors.successText } : null,
    sum.delivering > 0
      ? { k: 'del', icon: 'delivery', text: sum.delivering === sum.count && sum.count > 1 ? t('print.strip_delivering_all') : sum.delivering === 1 ? t('print.strip_delivering_1') : t('print.strip_delivering', { n: formatNumber(sum.delivering) }), tone: colors.accentText }
      : null,
  ] as (Fact | null)[]).filter((f): f is Fact => !!f);

  return (
    <View style={{ marginTop: spacing.xl }}>
      {/* head: a gold tile, the title over its facts, «عرض الكل» */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="storefront" size={19} color={colors.onAccent} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 26, color: colors.textPrimary }}>{t('print.shops_strip')}</Text>
          {/* thin bars between the facts, never «·» — beside digits it reads as ٠ */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {facts.map((f, i) => (
              <View key={f.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {i > 0 ? <View style={{ width: 1, height: 12, backgroundColor: colors.border }} /> : null}
                <Icon name={f.icon} size={12} color={f.tone ?? colors.textTertiary} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: f.tone ?? colors.textSecondary }} numberOfLines={1}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>
        <TouchableOpacity onPress={onAll} accessibilityRole="button" hitSlop={8} activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.brandTint }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('print.see_all')}</Text>
          <Icon name="back" size={13} color={colors.brand} />
        </TouchableOpacity>
      </View>

      {/* quick chips — they re-order the strip here, nothing is fetched */}
      {chips.length ? (
        <Surface id="teacher.print_tab.shops.chips">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            {chips.map((c) => {
              const on = c === active;
              return (
                <TouchableOpacity key={c} onPress={() => setChip(c)} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border }}>
                  <Icon name={CHIP_ICON[c]} size={13} color={on ? colors.onPrimary : colors.textTertiary} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.onPrimary : colors.textSecondary }}>{t(CHIP_LABEL[c])}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Surface>
      ) : null}

      {/* re-keyed per chip so a new order starts at its first card */}
      <ScrollView key={active} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 4 }}>
        {shown.map((s) => <PrintTabShopCard key={s.vendor_id} s={s} labels={labels} used={used.get(s.vendor_id) ?? 0} focus={active} />)}

        {/* the end of the strip: every shop, on the map */}
        <Surface id="teacher.print_tab.shops.map">
          <TouchableOpacity onPress={onAll} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={t('print.strip_map_title')}
            style={{ width: 156, alignSelf: 'stretch', borderRadius: radius.xl, overflow: 'hidden' }}>
            <LinearGradient colors={gradients.auth} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: spacing.md, justifyContent: 'space-between' }}>
              {/* a hint of a map: two roads and three pins, barely there */}
              <View pointerEvents="none" style={{ position: 'absolute', top: 58, start: -20, width: 220, height: 2, backgroundColor: 'rgba(255,255,255,0.08)', transform: [{ rotate: '-18deg' }] }} />
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, end: 46, width: 2, backgroundColor: 'rgba(255,255,255,0.07)', transform: [{ rotate: '8deg' }] }} />
              <View pointerEvents="none" style={{ position: 'absolute', top: 34, end: 22, opacity: 0.5 }}><Icon name="location" size={14} color={colors.accent} /></View>
              <View pointerEvents="none" style={{ position: 'absolute', top: 96, start: 26, opacity: 0.35 }}><Icon name="location" size={12} color={colors.accent} /></View>
              <View pointerEvents="none" style={{ position: 'absolute', bottom: 72, end: 54, opacity: 0.28 }}><Icon name="location" size={11} color="#FFFFFF" /></View>

              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadows.md }}>
                <Icon name="location" size={24} color={colors.onAccent} />
              </View>
              <View style={{ gap: 4, marginTop: spacing.lg }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 23, color: '#FFFFFF' }}>{t('print.strip_map_title')}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 18, color: 'rgba(255,255,255,0.72)' }} numberOfLines={2}>{t('print.strip_map_sub')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
                <View style={{ flex: 1 }} />
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="back" size={16} color="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Surface>
      </ScrollView>
    </View>
  );
}
