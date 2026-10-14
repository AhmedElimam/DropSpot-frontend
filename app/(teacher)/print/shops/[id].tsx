import { useRef, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, Linking, Animated } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, isDark } from '@/theme/index';
import { ShopLogo } from '@/components/print/ShopLogo';
import { ShopPageHero } from '@/components/print/ShopPageHero';
import { ShopWorkGallery } from '@/components/print/ShopWorkGallery';
import { SampleViewer } from '@/components/print/SampleViewer';
import { ShopCapabilities, FINISH_CAPS } from '@/components/print/ShopCapabilities';
import { ShopFinishes } from '@/components/print/ShopFinishes';
import { ShopBranches } from '@/components/print/ShopBranches';
import { Icon, type IconName } from '@/components/ui/Icon';
import { FormScreen, Banner } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { formatNumber, formatShortDate, formatDateTime } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { getPrintShop, getPrintOptions, type ShopProfile, type ShopSample, type Choice } from '@/api/print';
import { Stars, BADGE_TINT } from './index';

const HERO = 236; // under the status bar; the inset is added on top
const OVERLAP = 40; // how far the identity card rides up over the photos

const BADGE_ICON: Record<string, IconName> = { cheapest: 'pricetag', fastest: 'flash', nearest: 'location', top_rated: 'ribbon' };

/** A thin bar, not «·»: beside Arabic digits a middle dot reads as a zero (٠). */
function Sep() {
  return <View style={{ width: 1, height: 12, backgroundColor: colors.border }} />;
}

/** A clean card with a small title — the page's one section shape. */
function Section({ icon, tint, bg, title, right, children }: { icon: IconName; tint: string; bg: string; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={tint} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

/** One number the shop stands on — a tinted icon, the value, what it means. */
function Fact({ icon, tint, bg, value, label }: { icon: IconName; tint: string; bg: string; value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
        <Icon name={icon} size={17} color={tint} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{value}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.textTertiary, textAlign: 'center' }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** The price card as a grid: one row per paper × sides, a column per ink — the cheapest cell in green. */
function PriceCard({ s, o, egp }: { s: ShopProfile; o: { papers: Choice[]; inks: Choice[]; sides: Choice[] }; egp: string }) {
  const { t } = useTranslation();
  const inks = o.inks.filter((i) => s.menu.rates.some((r) => r.ink === i.key));
  const rows = o.papers.flatMap((p) => o.sides.map((d) => ({ p, d, cells: inks.map((i) => s.menu.rates.find((r) => r.paper === p.key && r.ink === i.key && String(r.sides) === d.key)?.price_per_page ?? null) })))
    .filter((r) => r.cells.some((c) => c != null));
  const all = rows.flatMap((r) => r.cells.filter((c): c is number => c != null));
  const low = all.length ? Math.min(...all) : null;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brandTint, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: spacing.sm }}>
        <Text style={{ flex: 1.6, fontFamily: fonts.bold, fontSize: 11.5, color: colors.brand }}>{t('print.per_page_header', { egp })}</Text>
        {inks.map((i) => <Text key={i.key} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 12, color: colors.brand, textAlign: 'center' }} numberOfLines={1}>{i.label}</Text>)}
      </View>
      {rows.map((r, idx) => (
        <View key={`${r.p.key}-${r.d.key}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: spacing.sm, marginTop: 2, borderRadius: radius.sm, backgroundColor: idx % 2 === 1 ? colors.surfaceSunken : 'transparent' }}>
          <View style={{ flex: 1.6 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{r.p.label}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }} numberOfLines={1}>{r.d.label}</Text>
          </View>
          {r.cells.map((c, i) => (
            <Text key={i} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, textAlign: 'center', color: c == null ? colors.textTertiary : c === low ? colors.successText : colors.textPrimary }}>
              {c == null ? '—' : formatNumber(c, { maximumFractionDigits: 2 })}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** A soft pill button — call, maps. */
function PillButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.full, backgroundColor: colors.brandTint }}>
      <Icon name={icon} size={17} color={colors.brand} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/** An icon and a line of text — the «where» details. */
function InfoRow({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm }}>
      <View style={{ paddingTop: 2 }}><Icon name={icon} size={16} color={colors.textTertiary} /></View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/**
 * One shop's page (founder 2026-10-14: «on printshop details we need also some love»), the
 * way a delivery app opens a restaurant: the shop's own work full-bleed at the top, its face
 * on a card riding over the photos, the numbers it stands on, delivery or pickup, then what
 * it can do, its deals, the whole price card, where it is, and what teachers said.
 * Round 7 (founder 2026-10-14): the work gets its own gallery under the card, «تقدر تطبع»
 * is grouped tiles, and binding per copy is its own drawn section.
 * «اطلب من المطبعة» opens the composer locked to THIS shop's menu.
 */
export default function PrintShopPage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const shop = useQuery({ queryKey: ['print-shop', id], queryFn: () => getPrintShop(id!), enabled: !!id });
  const options = useQuery({ queryKey: ['print-options'], queryFn: getPrintOptions });
  const scrollY = useRef(new Animated.Value(0)).current;
  const [solid, setSolid] = useState(false);
  const [viewing, setViewing] = useState<{ list: ShopSample[]; i: number } | null>(null);
  const s = shop.data;
  const o = options.data;
  const egp = t('teacher.egp');

  if (shop.isLoading || options.isLoading) {
    return <FormScreen title={t('print.shop')} loading>{null}</FormScreen>;
  }
  if (!s || !o) {
    return <FormScreen title={t('print.shop')}><Banner tone="warn" text={t('print.shop_off')} /></FormScreen>;
  }

  const heroH = HERO + insets.top;
  const barH = insets.top + 58;
  const fadeFrom = heroH - barH - 70;
  const barOpacity = scrollY.interpolate({ inputRange: [fadeFrom, fadeFrom + 50], outputRange: [0, 1], extrapolate: 'clamp' });
  const samples = s.samples ?? [];

  const finishes = s.menu.finishes.filter((f) => f.kind !== 'none');
  const extras = s.extras ?? [];
  const paused = !!s.paused_until && new Date(s.paused_until).getTime() > Date.now();
  const extraSizes = (s.sizes ?? []).filter((z) => z !== 'A4');
  const hasDeals = (s.volume_tiers?.length ?? 0) > 0 || !!s.rush || extraSizes.length > 0;
  const finishLabel = (k: string) => o.finishes.find((c) => c.key === k)?.label ?? k;
  const hasMap = s.lat != null && s.lng != null;
  const tints = BADGE_TINT();
  const priceFrom = s.price_from.bw ?? s.price_from.color;
  const n2 = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });

  const state = paused ? { text: t('print.paused_tag'), bg: colors.warningLight, fg: colors.warningText, dot: colors.warning }
    : s.open_now === true ? { text: t('print.open_now'), bg: colors.successLight, fg: colors.successText, dot: colors.success }
    : s.open_now === false ? { text: t('print.closed_now'), bg: colors.surfaceSunken, fg: colors.textSecondary, dot: colors.textTertiary } : null;

  const order = () => router.push({ pathname: '/(teacher)/print/new', params: { vendor: String(s.vendor_id) } } as Href);
  const openMaps = () => { if (hasMap) Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`); };

  return (
    <Surface id="screen.teacher.print_shop" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={samples.length && !solid ? 'light' : isDark() ? 'light' : 'dark'} />
      <Animated.ScrollView showsVerticalScrollIndicator={false} scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
            const past = e.nativeEvent.contentOffset.y > fadeFrom + 25;
            setSolid(past);
          },
        })}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>

        {/* the shop's own work, edge to edge */}
        <Surface id="teacher.print_shop.gallery" fallback={<ShopPageHero items={[]} height={heroH} overlap={OVERLAP} topInset={insets.top} />}>
          <ShopPageHero items={samples} height={heroH} overlap={OVERLAP} topInset={insets.top} onOpen={(i) => setViewing({ list: samples, i })} />
        </Surface>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {/* who it is — the card riding over the photos */}
          <View style={{ marginTop: -OVERLAP, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, marginBottom: spacing.md, ...shadows.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View style={{ marginTop: -36, borderRadius: 24, ...shadows.md }}>
                <ShopLogo logo={s.logo} size={76} premium={s.quality_tier === 'premium'} ring />
              </View>
              {state ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: state.bg }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: state.dot }} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: state.fg }}>{state.text}</Text>
                </View>
              ) : null}
            </View>

            <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: colors.textPrimary, marginTop: spacing.sm }} numberOfLines={2}>{s.name}</Text>
            {s.tagline ? <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, lineHeight: 21, marginTop: 2 }} numberOfLines={3}>{s.tagline}</Text> : null}

            {/* ★ 4.7 (3) | 11 س | 1.2 كم */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: spacing.sm }}>
              {s.rating != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Icon name="star" size={14} color={colors.warning} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{formatNumber(s.rating, { maximumFractionDigits: 1 })}</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textTertiary }}>({formatNumber(s.ratings)})</Text>
                </View>
              ) : <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.accentText }}>{t('print.new_shop_short')}</Text>}
              <Sep />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Icon name="clock" size={14} color={s.speed_measured ? colors.success : colors.textTertiary} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: s.speed_measured ? colors.successText : colors.textSecondary }}>{t('print.hours_short', { h: formatNumber(s.speed_hours) })}</Text>
              </View>
              {s.distance_km != null ? (
                <>
                  <Sep />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Icon name="location" size={14} color={colors.textTertiary} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('print.km_away', { km: formatNumber(s.distance_km, { maximumFractionDigits: 1 }) })}</Text>
                  </View>
                </>
              ) : null}
            </View>

            {[s.quality_label, s.ink_tech_label, s.city].some(Boolean) ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary, marginTop: 6 }} numberOfLines={1}>
                {[s.quality_label, s.ink_tech_label, s.city].filter(Boolean).join(' · ')}
              </Text>
            ) : null}

            {s.badges.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
                {s.badges.map((b) => (
                  <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: tints[b]?.bg ?? colors.surfaceSunken }}>
                    <Icon name={BADGE_ICON[b] ?? 'trophy'} size={13} color={tints[b]?.fg ?? colors.textSecondary} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: tints[b]?.fg ?? colors.textSecondary }}>{o.badges[b] ?? b}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {paused ? <Banner tone="warn" icon="clock" text={t('print.paused_banner', { at: formatDateTime(s.paused_until!) })} /> : null}
          {s.open_jobs > 0 ? <Banner tone="warn" icon="clock" text={t('print.busy_now', { n: formatNumber(s.open_jobs) })} /> : null}

          {/* its work, in its own place — right under who it is */}
          {samples.length ? (
            <Surface id="teacher.print_shop.work">
              <ShopWorkGallery items={samples} onOpen={(list, i) => setViewing({ list, i })} />
            </Surface>
          ) : null}

          {/* the numbers it stands on */}
          <Surface id="teacher.print_shop.stats">
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, marginBottom: spacing.md, ...shadows.sm }}>
            <Fact icon="star" tint={colors.warningText} bg={colors.warningLight} value={s.rating != null ? formatNumber(s.rating, { maximumFractionDigits: 1 }) : '—'}
              label={s.ratings > 0 ? t('print.stats_rating_n', { n: formatNumber(s.ratings) }) : t('print.stats_rating')} />
            <View style={{ width: 1, alignSelf: 'stretch', marginVertical: 6, backgroundColor: colors.borderLight }} />
            <Fact icon="clock" tint={s.speed_measured ? colors.successText : colors.textSecondary} bg={s.speed_measured ? colors.successLight : colors.surfaceSunken}
              value={t('print.hours_short', { h: formatNumber(s.speed_hours) })} label={t(s.speed_measured ? 'print.stats_speed_real' : 'print.stats_speed_promise')} />
            <View style={{ width: 1, alignSelf: 'stretch', marginVertical: 6, backgroundColor: colors.borderLight }} />
            <Fact icon="success" tint={colors.brand} bg={colors.brandTint} value={s.on_time_pct != null ? `${formatNumber(s.on_time_pct)}٪` : '—'} label={t('print.stats_on_time')} />
            <View style={{ width: 1, alignSelf: 'stretch', marginVertical: 6, backgroundColor: colors.borderLight }} />
            <Fact icon="print" tint={colors.accentText} bg={colors.accentLight} value={formatNumber(s.jobs_done)} label={t('print.stats_done')} />
          </View>
          </Surface>

          {/* delivery or pickup */}
          {s.delivery || s.pickup || s.min_copies > 1 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {s.delivery ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="delivery" size={19} color={colors.accentText} />
                    </View>
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                      {s.delivery_fee > 0 ? t('print.delivery_chip', { p: n2(s.delivery_fee) }) : t('print.free_delivery')}
                    </Text>
                  </View>
                ) : null}
                {s.delivery && s.pickup ? <View style={{ width: 1, height: 30, backgroundColor: colors.borderLight }} /> : null}
                {s.pickup ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="storefront" size={18} color={colors.brand} />
                    </View>
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{t('print.pickup_chip')}</Text>
                  </View>
                ) : null}
              </View>
              {s.min_copies > 1 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: s.delivery || s.pickup ? spacing.sm : 0, paddingTop: s.delivery || s.pickup ? spacing.sm : 0, borderTopWidth: s.delivery || s.pickup ? 1 : 0, borderTopColor: colors.borderLight }}>
                  <Icon name="info" size={15} color={colors.textTertiary} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('print.min_copies_line', { n: formatNumber(s.min_copies) })}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* what it can do — binding has its own drawn section below */}
          {s.capabilities.some((c) => !(finishes.length && FINISH_CAPS.includes(c))) || s.notes ? (
            <Surface id="teacher.print_shop.capabilities">
            <Section icon="print" tint={colors.brand} bg={colors.brandTint} title={t('print.capabilities_title')}>
              <ShopCapabilities caps={s.capabilities} labels={o.capabilities} notes={s.notes} skipFinishes={finishes.length > 0} />
            </Section>
            </Surface>
          ) : null}

          {/* binding, per copy — drawn */}
          {finishes.length > 0 ? (
            <Surface id="teacher.print_shop.finishes">
            <Section icon="book" tint={colors.warningText} bg={colors.warningLight} title={t('print.finishes_title')}>
              <ShopFinishes finishes={finishes} label={finishLabel} egp={egp} />
            </Section>
            </Surface>
          ) : null}

          {/* deals: bulk discounts, rush, other sizes */}
          {hasDeals ? (
            <Surface id="teacher.print_shop.deals">
            <Section icon="pricetag" tint={colors.successText} bg={colors.successLight} title={t('print.deals_title')}>
              {(s.volume_tiers ?? []).map((tier, i) => (
                <View key={tier.min_pages} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderLight }}>
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{t('print.tier_line', { n: formatNumber(tier.min_pages) })}</Text>
                  <View style={{ backgroundColor: colors.successLight, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.successText }}>{t('print.tier_off', { p: formatNumber(tier.pct) })}</Text>
                  </View>
                </View>
              ))}
              {s.rush ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: (s.volume_tiers?.length ?? 0) > 0 ? spacing.sm : 0, backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm }}>
                  <Icon name="flash" size={16} color={colors.warningText} />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.warningText, lineHeight: 19 }}>{t('print.rush_line', { h: formatNumber(s.rush.hours), p: formatNumber(s.rush.pct) })}</Text>
                </View>
              ) : null}
              {extraSizes.length ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: (s.volume_tiers?.length ?? 0) > 0 || s.rush ? spacing.sm : 0 }}>
                  <View style={{ paddingTop: 2 }}><Icon name="document" size={15} color={colors.textTertiary} /></View>
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, lineHeight: 19 }}>
                    {t('print.sizes_line', { list: extraSizes.map((z) => `${z} × ${n2(Number(s.size_factors?.[z] ?? 1))}`).join('، ') })}
                  </Text>
                </View>
              ) : null}
            </Section>
            </Surface>
          ) : null}

          {/* the price card, finishes and the shop's own extras */}
          <Surface id="teacher.print_shop.prices">
          <Section icon="money" tint={colors.accentText} bg={colors.accentLight} title={t('print.price_card')}>
            <PriceCard s={s} o={o} egp={egp} />
          </Section>
          {extras.length > 0 ? (
            <Section icon="add" tint={colors.brand} bg={colors.brandTint} title={t('print.extras')}>
              {extras.map((x, i) => (
                <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderLight }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary }}>{x.name}</Text>
                    {x.unit_label ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{x.unit_label}</Text> : null}
                  </View>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>+{n2(x.price)} {egp}</Text>
                </View>
              ))}
            </Section>
          ) : null}
          </Surface>

          {/* its branches, nearest first (founder 2026-10-14) */}
          {(s.branches?.length ?? 0) > 1 ? (
            <Surface id="teacher.print_shop.branches">
            <Section icon="location" tint={colors.accentText} bg={colors.accentLight} title={t('print.branches_title', { n: formatNumber(s.branches!.length) })}>
              <ShopBranches branches={s.branches!} />
            </Section>
            </Surface>
          ) : null}

          {/* where */}
          {s.address || s.phone || hasMap || s.hours_label || s.distance_km != null ? (
            <Surface id="teacher.print_shop.contact">
            <Section icon="location" tint={colors.successText} bg={colors.successLight} title={t('print.shop_where')}>
              {s.address ? (
                <InfoRow icon="location">
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary, lineHeight: 20 }}>{s.address}</Text>
                </InfoRow>
              ) : null}
              {s.distance_km != null ? (
                <InfoRow icon="gps">
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('print.km_from_you', { km: formatNumber(s.distance_km, { maximumFractionDigits: 1 }) })}</Text>
                </InfoRow>
              ) : null}
              {s.hours_label ? (
                <InfoRow icon="clock">
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{s.hours_label}</Text>
                </InfoRow>
              ) : null}
              {s.phone ? (
                <InfoRow icon="call">
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{s.phone}</Text>
                </InfoRow>
              ) : null}
              {s.phone || hasMap ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  {s.phone ? <PillButton icon="call" label={t('print.call')} onPress={() => Linking.openURL(`tel:${s.phone}`)} /> : null}
                  {hasMap ? <PillButton icon="gps" label={t('print.shop_open_in_maps')} onPress={openMaps} /> : null}
                </View>
              ) : null}
            </Section>
            </Surface>
          ) : null}

          {/* what teachers said */}
          <Surface id="teacher.print_shop.reviews">
          <Section icon="thumbUp" tint={colors.warningText} bg={colors.warningLight} title={t('print.reviews_title')}>
            {s.rating != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: s.reviews.length ? spacing.md : 0 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 38, lineHeight: 46, color: colors.textPrimary }}>{formatNumber(s.rating, { maximumFractionDigits: 1 })}</Text>
                <View style={{ gap: 4 }}>
                  <Stars n={s.rating} size={17} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('print.stats_rating_n', { n: formatNumber(s.ratings) })}</Text>
                </View>
              </View>
            ) : null}
            {s.reviews.length === 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('print.no_reviews')}</Text>
            ) : s.reviews.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: i === 0 ? 0 : spacing.md }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{(r.teacher || '?').trim().charAt(0)}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderTopStartRadius: 4, padding: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{r.teacher}</Text>
                    {r.at ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{formatShortDate(r.at)}</Text> : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 }}>
                    <Stars n={r.rating} size={12} />
                    {r.what ? <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }} numberOfLines={1}>{r.what}</Text> : null}
                  </View>
                  {r.review ? <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textPrimary, marginTop: 6, lineHeight: 21 }}>{r.review}</Text> : null}
                </View>
              </View>
            ))}
          </Section>
          </Surface>
        </View>
      </Animated.ScrollView>

      {/* the bar that fades in once the photos scroll away */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, end: 0, height: barH, paddingTop: insets.top, opacity: barOpacity, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight, ...shadows.sm }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingStart: spacing.lg + 42 + spacing.sm, paddingEnd: spacing.lg }}>
          <ShopLogo logo={s.logo} size={30} premium={s.quality_tier === 'premium'} />
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
        </View>
      </Animated.View>

      {/* back — a round button floating on the photo */}
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}
        style={{ position: 'absolute', top: insets.top + 8, start: spacing.lg, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.md }}>
        <Icon name="forward" size={20} color={colors.textPrimary} />
      </TouchableOpacity>

      <SampleViewer items={viewing?.list ?? []} start={viewing?.i ?? null} onClose={() => setViewing(null)} />

      {/* the one button */}
      <Surface id="teacher.print_shop.order">
      <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadows.lg }}>
        {priceFrom != null ? (
          <View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{t('print.from')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{n2(priceFrom)}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary }}>{s.price_from.bw != null ? t('print.egp_page') : t('print.color_short')}</Text>
            </View>
          </View>
        ) : null}
        <Button style={{ flex: 1 }} title={paused ? t('print.paused_tag') : t('print.shop_order')} disabled={paused} onPress={order} />
      </View>
      </Surface>
    </View>
    </Surface>
  );
}
