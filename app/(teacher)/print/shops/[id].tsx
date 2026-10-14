import { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ScrollView, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { AppModal as Modal } from '@/ui/AppModal';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { ShopLogo } from '@/components/print/ShopLogo';
import { Icon, type IconName } from '@/components/ui/Icon';
import { FormScreen, FormCard, Banner } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { formatNumber, formatShortDate, formatDateTime } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { getPrintShop, getPrintOptions, sampleSource, type ShopProfile, type ShopSample, type Choice } from '@/api/print';
import { Stars, Badges, Capabilities, SpeedLine, Tag } from './index';

/** The shop's work, swipeable — tap a photo for the full screen. */
function Gallery({ items }: { items: ShopSample[] }) {
  const { width } = useWindowDimensions();
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const w = width - spacing.lg * 2;
  if (!items.length) return null;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ borderRadius: radius.xl, overflow: 'hidden' }}
        onMomentumScrollEnd={(e) => setAt(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / w))}>
        {items.map((p, i) => (
          <Pressable key={p.id} onPress={() => setOpen(i)} accessibilityRole="imagebutton" accessibilityLabel={p.caption ?? undefined}>
            <Image source={sampleSource(p.url)} style={{ width: w, height: 220, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={150} recyclingKey={String(p.id)} />
            {p.caption || p.kind_label ? (
              <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, padding: spacing.sm, backgroundColor: 'rgba(10,14,39,0.55)' }}>
                {p.kind_label ? <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{p.kind_label}</Text> : null}
                {p.caption ? <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: '#fff' }} numberOfLines={1}>{p.caption}</Text> : null}
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      {items.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          {items.map((p, i) => <View key={p.id} style={{ width: i === at ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === at ? colors.brand : colors.border }} />)}
        </View>
      ) : null}
      <Modal visible={open != null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: (open ?? 0) * width, y: 0 }}>
            {items.map((p) => (
              <Pressable key={p.id} onPress={() => setOpen(null)} style={{ width, justifyContent: 'center' }}>
                <Image source={sampleSource(p.url)} style={{ width, height: '78%' }} contentFit="contain" />
                {p.caption ? <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: '#fff', textAlign: 'center', padding: spacing.md }}>{p.caption}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => setOpen(null)} accessibilityRole="button" style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 24, end: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={22} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/** A number the shop stands on — rating, speed, on-time, jobs done — as one tile. */
function Stat({ icon, value, label, tint }: { icon: IconName; value: string; label: string; tint: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm }}>
      <Icon name={icon} size={16} color={tint} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginTop: 3 }}>{value}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.textTertiary }}>{label}</Text>
    </View>
  );
}

/** The price card as a grid: one row per paper × sides, a column per ink. */
function PriceCard({ s, o, egp }: { s: ShopProfile; o: { papers: Choice[]; inks: Choice[]; sides: Choice[] }; egp: string }) {
  const { t } = useTranslation();
  const inks = o.inks.filter((i) => s.menu.rates.some((r) => r.ink === i.key));
  const rows = o.papers.flatMap((p) => o.sides.map((d) => ({ p, d, cells: inks.map((i) => s.menu.rates.find((r) => r.paper === p.key && r.ink === i.key && String(r.sides) === d.key)?.price_per_page ?? null) })))
    .filter((r) => r.cells.some((c) => c != null));
  return (
    <View>
      <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ flex: 1.6, fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary }}>{t('print.per_page_header', { egp })}</Text>
        {inks.map((i) => <Text key={i.key} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>{i.label}</Text>)}
      </View>
      {rows.map((r, idx) => (
        <View key={`${r.p.key}-${r.d.key}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: idx === rows.length - 1 ? 0 : 1, borderBottomColor: colors.borderLight }}>
          <View style={{ flex: 1.6 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{r.p.label}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{r.d.label}</Text>
          </View>
          {r.cells.map((c, i) => (
            <Text key={i} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: c == null ? colors.textTertiary : colors.textPrimary, textAlign: 'center' }}>
              {c == null ? '—' : formatNumber(c, { maximumFractionDigits: 2 })}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * One shop's page — the driver's profile before you tap «اطلب». Standing in numbers, what it
 * can do, the whole price card, where it is, and what teachers said after receiving their prints.
 * «اطلب من هنا» opens the composer locked to THIS shop's menu.
 */
export default function PrintShopPage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const shop = useQuery({ queryKey: ['print-shop', id], queryFn: () => getPrintShop(id!), enabled: !!id });
  const options = useQuery({ queryKey: ['print-options'], queryFn: getPrintOptions });
  const s = shop.data;
  const o = options.data;
  const egp = t('teacher.egp');

  if (shop.isLoading || options.isLoading) {
    return <FormScreen title={t('print.shop')} loading>{null}</FormScreen>;
  }
  if (!s || !o) {
    return <FormScreen title={t('print.shop')}><Banner tone="warn" text={t('print.shop_off')} /></FormScreen>;
  }
  const finishes = s.menu.finishes.filter((f) => f.kind !== 'none');
  const paused = !!s.paused_until && new Date(s.paused_until).getTime() > Date.now();
  const extraSizes = (s.sizes ?? []).filter((z) => z !== 'A4');
  const hasDeals = (s.volume_tiers?.length ?? 0) > 0 || !!s.rush || extraSizes.length > 0;
  const finishLabel = (k: string) => o.finishes.find((c) => c.key === k)?.label ?? k;

  return (
    <Surface id="screen.teacher.print_shop" screen>
    <FormScreen title={s.name} subtitle={[s.city, s.quality_label, s.ink_tech_label].filter(Boolean).join(' · ')}
      contentStyle={{ paddingBottom: nav.pageEnd + insets.bottom + 96 }}>
      {paused ? <Banner tone="warn" icon="clock" text={t('print.paused_banner', { at: formatDateTime(s.paused_until!) })} /> : null}
      <Surface id="teacher.print_shop.gallery"><Gallery items={s.samples ?? []} /></Surface>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
        <ShopLogo logo={s.logo} size={60} premium={s.quality_tier === 'premium'} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
          {s.tagline ? <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, lineHeight: 20 }} numberOfLines={2}>{s.tagline}</Text> : null}
        </View>
      </View>
      {s.badges.length > 0 || s.open_now != null ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: spacing.md, alignItems: 'center' }}>
          {s.open_now != null && !paused ? <Tag text={t(s.open_now ? 'print.open_now' : 'print.closed_now')} bg={s.open_now ? colors.successLight : colors.surfaceSunken} fg={s.open_now ? colors.successText : colors.textSecondary} /> : null}
          <Badges list={s.badges} labels={o.badges} />
        </View>
      ) : null}

      {/* standing */}
      <Surface id="teacher.print_shop.stats">
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <Stat icon="star" tint={colors.warning} value={s.rating != null ? formatNumber(s.rating, { maximumFractionDigits: 1 }) : '—'} label={s.ratings > 0 ? t('print.stats_rating_n', { n: formatNumber(s.ratings) }) : t('print.stats_rating')} />
        <Stat icon="clock" tint={s.speed_measured ? colors.success : colors.textTertiary} value={t('print.hours_short', { h: formatNumber(s.speed_hours) })} label={t(s.speed_measured ? 'print.stats_speed_real' : 'print.stats_speed_promise')} />
        <Stat icon="success" tint={colors.brand} value={s.on_time_pct != null ? `${formatNumber(s.on_time_pct)}٪` : '—'} label={t('print.stats_on_time')} />
        <Stat icon="print" tint={colors.accent} value={formatNumber(s.jobs_done)} label={t('print.stats_done')} />
      </View>
      </Surface>
      {s.open_jobs > 0 ? <Banner tone="warn" icon="clock" text={t('print.busy_now', { n: formatNumber(s.open_jobs) })} /> : null}

      {/* what it can do */}
      <Surface id="teacher.print_shop.capabilities">
      <FormCard icon="settings" title={t('print.capabilities_title')} tint={colors.brand}>
        <Capabilities list={s.capabilities} labels={o.capabilities} max={12} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.sm }}>
          {[s.pickup ? o.delivery_modes.find((d) => d.key === 'pickup')?.label : null, s.delivery ? t('print.delivery_fee_line', { p: formatNumber(s.delivery_fee, { maximumFractionDigits: 2 }) }) : null, s.min_copies > 1 ? t('print.min_copies_line', { n: formatNumber(s.min_copies) }) : null].filter(Boolean).join(' · ')}
        </Text>
        {s.hours_label ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
            <Icon name="clock" size={15} color={colors.textSecondary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{s.hours_label}</Text>
          </View>
        ) : null}
        {s.notes ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary, marginTop: spacing.sm, lineHeight: 20 }}>{s.notes}</Text> : null}
      </FormCard>
      </Surface>

      {/* deals: bulk discounts · rush · other sizes */}
      {hasDeals ? (
        <Surface id="teacher.print_shop.deals">
        <FormCard icon="pricetag" title={t('print.deals_title')} tint={colors.success}>
          {(s.volume_tiers ?? []).map((tier) => (
            <View key={tier.min_pages} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{t('print.tier_line', { n: formatNumber(tier.min_pages) })}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.successText }}>{t('print.tier_off', { p: formatNumber(tier.pct) })}</Text>
            </View>
          ))}
          {s.rush ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
              <Icon name="clock" size={15} color={colors.warningDark} />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{t('print.rush_line', { h: formatNumber(s.rush.hours), p: formatNumber(s.rush.pct) })}</Text>
            </View>
          ) : null}
          {extraSizes.length ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary, paddingVertical: 4 }}>
              {t('print.sizes_line', { list: extraSizes.map((z) => `${z} × ${formatNumber(Number(s.size_factors?.[z] ?? 1), { maximumFractionDigits: 2 })}`).join(' · ') })}
            </Text>
          ) : null}
        </FormCard>
        </Surface>
      ) : null}

      {/* the price card */}
      <Surface id="teacher.print_shop.prices">
      <FormCard icon="pricetag" title={t('print.price_card')} tint={colors.accent}>
        <PriceCard s={s} o={o} egp={egp} />
        {finishes.length > 0 ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary, marginBottom: 4 }}>{t('print.finishes_title')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {finishes.map((f) => (
                <View key={f.kind} style={{ flexDirection: 'row', gap: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }}>{finishLabel(f.kind)}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }}>+{formatNumber(f.price_per_copy, { maximumFractionDigits: 2 })}{t('print.per_copy_short')}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </FormCard>
      </Surface>

      {/* where */}
      {s.address || s.phone ? (
        <Surface id="teacher.print_shop.contact">
        <FormCard icon="location" title={t('print.shop_where')} tint={colors.success}>
          {s.address ? <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textPrimary, lineHeight: 20 }}>{s.address}</Text> : null}
          {s.distance_km != null ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('print.km_from_you', { km: formatNumber(s.distance_km, { maximumFractionDigits: 1 }) })}</Text> : null}
          {s.phone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${s.phone}`)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
              <Icon name="phone" size={16} color={colors.brand} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('print.call')} · {s.phone}</Text>
            </TouchableOpacity>
          ) : null}
        </FormCard>
        </Surface>
      ) : null}

      {/* what teachers said */}
      <Surface id="teacher.print_shop.reviews">
      <FormCard icon="thumbUp" title={t('print.reviews_title')} tint={colors.warning}>
        {s.reviews.length === 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('print.no_reviews')}</Text>
        ) : s.reviews.map((r, i) => (
          <View key={i} style={{ paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Stars n={r.rating} size={13} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>{r.teacher}</Text>
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, textAlign: 'left' }}>{r.at ? formatShortDate(r.at) : ''}</Text>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 2 }}>{r.what}</Text>
            {r.review ? <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textPrimary, marginTop: 4, lineHeight: 20 }}>{r.review}</Text> : null}
          </View>
        ))}
      </FormCard>
      </Surface>

      {/* the one button */}
      <Surface id="teacher.print_shop.order">
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <SpeedLine s={s} size={13} />
          {s.price_from.bw != null ? <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('print.from_per_page', { p: formatNumber(s.price_from.bw, { maximumFractionDigits: 2 }) })}</Text> : null}
        </View>
        <Button title={paused ? t('print.paused_tag') : t('print.choose_shop')} disabled={paused} onPress={() => router.push({ pathname: '/(teacher)/print/new', params: { vendor: String(s.vendor_id) } } as Href)} />
      </View>
      </Surface>
    </FormScreen>
    </Surface>
  );
}
