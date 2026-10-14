import { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, useWindowDimensions, type ScrollView as RNScrollView } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { parseQuery, shopMatches, suggest, type Suggestion } from '@/utils/shopSearch';
import { ScrollView } from '@/components/ui/Refreshable';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing, radius, nav, shadows, isDark } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber } from '@/utils/format';
import { LiveMap, useMyLocation, type MapPoint } from '@/components/LiveMap';
import { ShopLogo } from '@/components/print/ShopLogo';
import { Surface } from '@/ui/surfaces';
import { Image } from 'expo-image';
import { getPrintShops, getPrintOptions, sampleSource, type MarketShop } from '@/api/print';

type Sort = 'recommended' | 'nearest' | 'fastest' | 'cheapest' | 'top_rated';
const SORTS: Sort[] = ['recommended', 'nearest', 'fastest', 'cheapest', 'top_rated'];

export const BADGE_TINT = (): Record<string, { bg: string; fg: string }> => ({
  cheapest: { bg: colors.successLight, fg: colors.successText },
  fastest: { bg: colors.brandTint, fg: colors.brand },
  nearest: { bg: colors.accentLight, fg: colors.accentText },
  top_rated: { bg: colors.warningLight, fg: colors.warningText },
});

export function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} color={i <= Math.round(n) ? colors.warning : colors.border} />)}
    </View>
  );
}

/** The little pills a teacher scans for: «الأرخص», «الأسرع»… */
export function Badges({ list, labels }: { list: string[]; labels: Record<string, string> }) {
  const tints = BADGE_TINT();
  if (list.length === 0) return null;
  return (
    <>
      {list.map((b) => (
        <View key={b} style={{ backgroundColor: tints[b]?.bg ?? colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: tints[b]?.fg ?? colors.textSecondary }}>{labels[b] ?? b}</Text>
        </View>
      ))}
    </>
  );
}

/** What the shop can do — ألوان · وجهين · سلك… — as quiet chips. */
export function Capabilities({ list, labels, max = 6 }: { list: string[]; labels: Record<string, string>; max?: number }) {
  const shown = list.slice(0, max);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
      {shown.map((c) => (
        <View key={c} style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>{labels[c] ?? c}</Text>
        </View>
      ))}
      {list.length > max ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>+{formatNumber(list.length - max)}</Text> : null}
    </View>
  );
}

/** The speed line: measured from real jobs when there are enough, else the shop's promise. */
export function SpeedLine({ s, size = 12 }: { s: Pick<MarketShop, 'speed_hours' | 'speed_measured'>; size?: number }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Icon name="clock" size={size + 1} color={s.speed_measured ? colors.success : colors.textTertiary} />
      <Text style={{ fontFamily: fonts.medium, fontSize: size, color: s.speed_measured ? colors.successText : colors.textSecondary }}>
        {t(s.speed_measured ? 'print.speed_measured' : 'print.speed_promised', { h: formatNumber(s.speed_hours) })}
      </Text>
    </View>
  );
}

const BADGE_ICON: Record<string, IconName> = { cheapest: 'pricetag', fastest: 'flash', nearest: 'location', top_rated: 'ribbon' };

/** The price a page starts from, big, with its unit under it. */
function PriceFrom({ s, size = 20 }: { s: MarketShop; size?: number }) {
  const { t } = useTranslation();
  const p = s.price_from.bw ?? s.price_from.color;
  if (p == null) return null;
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.textTertiary }}>{t('print.from')}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: size, color: colors.textPrimary, lineHeight: size + 6 }}>{formatNumber(p, { maximumFractionDigits: 2 })}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.textTertiary }}>{s.price_from.bw != null ? t('print.egp_page') : t('print.color_short')}</Text>
    </View>
  );
}

/** ★ 4.7 (23) · ⏱ 24 س · 📍 1.2 كم — the line a teacher decides on. */
function MetaLine({ s }: { s: MarketShop }) {
  const { t } = useTranslation();
  // A thin bar, not «·»: beside Arabic digits a middle dot reads as a zero (٠).
  const dot = <View style={{ width: 1, height: 12, backgroundColor: colors.border }} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {s.rating != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Icon name="star" size={13} color={colors.warning} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>{formatNumber(s.rating, { maximumFractionDigits: 1 })}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>({formatNumber(s.ratings)})</Text>
        </View>
      ) : <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.accentText }}>{t('print.new_shop_short')}</Text>}
      {dot}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Icon name="clock" size={13} color={s.speed_measured ? colors.success : colors.textTertiary} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: s.speed_measured ? colors.successText : colors.textSecondary }}>{t('print.hours_short', { h: formatNumber(s.speed_hours) })}</Text>
      </View>
      {s.distance_km != null ? (
        <>
          {dot}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="location" size={13} color={colors.textTertiary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('print.km_away', { km: formatNumber(s.distance_km, { maximumFractionDigits: 1 }) })}</Text>
          </View>
        </>
      ) : null}
      {s.on_time_pct != null ? <>{dot}<Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('print.on_time', { p: formatNumber(s.on_time_pct) })}</Text></> : null}
    </View>
  );
}

/** Delivery or pickup, then what the shop can do — one row of chips. */
function InfoChips({ s, caps }: { s: MarketShop; caps: Record<string, string> }) {
  const { t } = useTranslation();
  const chip = (key: string, text: string, icon: IconName | null, strong = false) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: strong ? colors.accentLight : colors.surfaceSunken }}>
      {icon ? <Icon name={icon} size={13} color={strong ? colors.accentText : colors.textSecondary} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: strong ? colors.accentText : colors.textSecondary }}>{text}</Text>
    </View>
  );
  const shown = s.capabilities.filter((c) => c !== 'delivery').slice(0, 3);
  const more = s.capabilities.filter((c) => c !== 'delivery').length - shown.length;
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {s.delivery
        ? chip('d', s.delivery_fee > 0 ? t('print.delivery_chip', { p: formatNumber(s.delivery_fee, { maximumFractionDigits: 2 }) }) : t('print.free_delivery'), 'delivery', true)
        : chip('p', t('print.pickup_chip'), 'storefront')}
      {shown.map((c) => chip(c, caps[c] ?? c, null))}
      {more > 0 ? chip('more', `+${formatNumber(more)}`, null) : null}
    </View>
  );
}

/**
 * One shop on the marketplace (founder 2026-10-14: «put some love on the print shops
 * listing»), the way delivery apps show a restaurant: its work as the cover with its logo on
 * the edge, one ribbon for what it is best at, then name, the decision line (stars · real
 * speed · distance), the price a page starts from, and delivery-or-pickup first among the chips.
 * `compact` is the card floating over the map for the shop tapped there.
 */
export function ShopCard({ s, labels, caps, compact = false }: { s: MarketShop; labels: Record<string, string>; caps: Record<string, string>; egp?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const paused = !!s.paused_until && new Date(s.paused_until).getTime() > Date.now();
  const open = () => router.push(`/(teacher)/print/shops/${s.vendor_id}` as Href);
  const ribbon = s.badges[0];
  const tints = BADGE_TINT();
  const state = paused ? { text: t('print.paused_tag'), bg: 'rgba(10,14,39,0.78)', fg: '#fff' }
    : s.open_now === true ? { text: t('print.open_now'), bg: 'rgba(31,147,102,0.94)', fg: '#fff' }
    : s.open_now === false ? { text: t('print.closed_now'), bg: 'rgba(10,14,39,0.72)', fg: '#fff' } : null;

  if (compact) {
    return (
      <TouchableOpacity onPress={open} activeOpacity={0.9} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, ...shadows.lg }}>
        <ShopLogo logo={s.logo} size={54} premium={s.quality_tier === 'premium'} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
            {state ? <Tag text={state.text} bg={paused || s.open_now === false ? colors.surfaceSunken : colors.successLight} fg={paused || s.open_now === false ? colors.textSecondary : colors.successText} /> : null}
          </View>
          <MetaLine s={s} />
        </View>
        <PriceFrom s={s} size={18} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={open} activeOpacity={0.9} accessibilityRole="button"
      style={{ backgroundColor: colors.surface, borderRadius: 22, marginBottom: spacing.md, overflow: 'hidden', opacity: paused ? 0.82 : 1, ...shadows.md }}>
      {/* the shop's own work, first */}
      <View style={{ height: 148 }}>
        {s.cover ? (
          <Image source={sampleSource(s.cover.url)} style={{ width: '100%', height: '100%', backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={150} recyclingKey={String(s.cover.id)} />
        ) : (
          <LinearGradient colors={gradients.hero} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="print" size={46} color={colors.onHeroSoft} />
          </LinearGradient>
        )}
        <LinearGradient colors={['rgba(10,14,39,0)', 'rgba(10,14,39,0.45)']} style={{ position: 'absolute', start: 0, end: 0, bottom: 0, height: 64 }} />
        {state ? <View style={{ position: 'absolute', top: 10, start: 10 }}><Tag text={state.text} bg={state.bg} fg={state.fg} /></View> : null}
        {ribbon ? (
          <View style={{ position: 'absolute', top: 10, end: 10, flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: tints[ribbon]?.bg ?? colors.surface }}>
            <Icon name={BADGE_ICON[ribbon] ?? 'trophy'} size={13} color={tints[ribbon]?.fg ?? colors.textPrimary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: tints[ribbon]?.fg ?? colors.textPrimary }}>{labels[ribbon] ?? ribbon}</Text>
          </View>
        ) : null}
        {(s.samples_count ?? 0) > 1 ? (
          <View style={{ position: 'absolute', bottom: 10, end: 10, flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(10,14,39,0.66)' }}>
            <Icon name="images" size={12} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{formatNumber(s.samples_count ?? 0)}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
        {/* the logo on the photo's edge, the name beside it, the price at the other end */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <ShopLogo logo={s.logo} size={62} premium={s.quality_tier === 'premium'} ring style={{ marginTop: -30, ...shadows.md }} />
          <View style={{ flex: 1, paddingTop: 8, gap: 3 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>
              {[s.city, s.quality_label, s.ink_tech_label].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={{ paddingTop: 6 }}><PriceFrom s={s} /></View>
        </View>

        <View style={{ marginTop: spacing.sm }}><MetaLine s={s} /></View>
        {s.tagline ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 20 }} numberOfLines={2}>{s.tagline}</Text> : null}
        <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.sm }} />
        <InfoChips s={s} caps={caps} />
        {s.badges.length > 1 ? <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}><Badges list={s.badges.slice(1)} labels={labels} /></View> : null}
        {s.open_jobs > 0 ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.warningDark, marginTop: 8 }}>{t('print.busy_now', { n: formatNumber(s.open_jobs) })}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function Tag({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 2 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: fg }}>{text}</Text>
    </View>
  );
}

const SUGGEST_ICON: Record<Suggestion['kind'], IconName> = { sort: 'list', filter: 'success', shop: 'storefront', area: 'location' };

/**
 * «اختر مطبعتك» — the marketplace, shop first (founder 2026-10-14: «like Uber or inDrive»).
 * The map fills the page; the list is a sheet over it with TWO stops (founder 2026-10-14:
 * «two stops: half + full page»): half (the map above it) and the whole page. Dragged down
 * from half it is dismissed — the whole map, and a «القائمة» pill to bring it back; on the
 * full page a «الخريطة» pill does the same. «موقعي» rides just above the sheet, never under
 * it. Search reads what she means (src/utils/shopSearch.ts) and suggests while she types.
 */
export default function PrintShops() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const shops = useQuery({ queryKey: ['print-shops'], queryFn: getPrintShops });
  const options = useQuery({ queryKey: ['print-options'], queryFn: getPrintOptions });
  const { refreshing, onRefresh } = usePullRefresh(shops.refetch);
  const [sort, setSort] = useState<Sort>('recommended');
  const [sorting, setSorting] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [need, setNeed] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [stop, setStop] = useState<'half' | 'full' | 'gone'>('half');
  const [centre, setCentre] = useState<(MapPoint & { nonce: number }) | null>(null);
  const here = useMyLocation(true);
  const listRef = useRef<RNScrollView>(null);
  const cardY = useRef<Record<number, number>>({});

  // The filters a teacher actually asks for, in the order they ask.
  const FILTERS = ['color', 'delivery', 'rush', 'spiral', 'duplex', 'a5', 'bulk', 'laminate'];
  const caps = options.data?.capabilities ?? {};
  const labels = options.data?.badges ?? {};
  const all = shops.data?.shops ?? [];
  const parsed = useMemo(() => parseQuery(query, caps), [query, caps]);
  const suggestions = useMemo(() => (searching && query.trim() ? suggest(query, all, caps) : []), [searching, query, all, caps]);

  const list = useMemo(() => {
    const hits = all.filter((s) => shopMatches(s, parsed, caps) && need.every((c) => s.capabilities.includes(c)));
    const order = sort !== 'recommended' ? sort : parsed.sort ?? 'recommended';
    const by = <T,>(f: (s: MarketShop) => T | null | undefined, dir = 1) => [...hits].sort((a, b) => {
      const x = f(a); const y = f(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
    switch (order) {
      case 'nearest': return by((s) => s.distance_km);
      case 'fastest': return by((s) => s.speed_hours);
      case 'cheapest': return by((s) => s.price_from.bw ?? s.price_from.color);
      case 'top_rated': return by((s) => s.rating, -1);
      default: return hits;
    }
  }, [all, parsed, caps, sort, need]);

  const coming = shops.data?.coming ?? [];
  const egp = t('teacher.egp');
  const toggle = (c: string) => setNeed((n) => (n.includes(c) ? n.filter((x) => x !== c) : [...n, c]));

  // ── the sheet: two stops, and dismissed ─────────────────────────────────────────────
  const FULL = 0;
  const HALF = Math.round(H * 0.44);
  const GONE = H;
  const y = useSharedValue(HALF);
  const from = useSharedValue(HALF);
  const go = (to: 'half' | 'full' | 'gone') => {
    setStop(to);
    y.value = withSpring(to === 'full' ? FULL : to === 'half' ? HALF : GONE, { damping: 26, stiffness: 260, mass: 0.9 });
  };
  const pan = Gesture.Pan()
    .onStart(() => { from.value = y.value; })
    .onUpdate((e) => { y.value = Math.max(FULL, from.value + e.translationY); })
    .onEnd((e) => {
      const at = y.value + e.velocityY * 0.15;
      const next = at < (FULL + HALF) / 2 ? 'full' : at > HALF + 120 ? 'gone' : 'half';
      runOnJS(go)(next);
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  // «موقعي» sits 60 above the sheet's top, and fades out on the full page.
  const locateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(y.value, H - insets.bottom - 24) - 60 }],
    opacity: y.value < HALF - 40 ? Math.max(0, (y.value - FULL) / (HALF - 40 - FULL)) : 1,
  }));

  const pickOnMap = (id: number) => {
    setPicked(id);
    if (stop === 'gone') go('half');
    setTimeout(() => {
      const top = cardY.current[id];
      if (top != null) listRef.current?.scrollTo({ y: Math.max(0, top - 8), animated: true });
    }, 250);
  };
  const openSearch = () => { setSearching(true); go('full'); };
  const closeSearch = () => { setQuery(''); setSearching(false); };
  const take = (sg: Suggestion) => {
    if (sg.kind === 'sort') { setSort(sg.key as Sort); setQuery(''); setSearching(false); }
    else if (sg.kind === 'filter') { if (!need.includes(sg.key)) toggle(sg.key); setQuery(''); setSearching(false); }
    else if (sg.kind === 'area') setQuery(sg.text);
    else router.push(`/(teacher)/print/shops/${sg.id}` as Href);
  };
  const suggestLabel = (sg: Suggestion) => (sg.kind === 'sort' ? t('print.suggest_sort', { s: t(`print.sort_${sg.key}`) })
    : sg.kind === 'filter' ? t('print.suggest_filter', { c: caps[sg.key] ?? sg.key })
    : sg.kind === 'area' ? sg.text : sg.name);
  const chip = (on: boolean) => ({ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border });
  const pill = { position: 'absolute' as const, alignSelf: 'center' as const, bottom: insets.bottom + spacing.lg, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, height: 46, paddingHorizontal: 20, borderRadius: 23, backgroundColor: colors.textPrimary, ...shadows.lg };

  return (
    <Surface id="screen.teacher.print_shops" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={stop === 'full' ? (isDark() ? 'light' : 'dark') : isDark() ? 'light' : 'dark'} />
      {/* the map, the whole page */}
      <LiveMap mapsKey={options.data?.maps_key} showMe hideLocate rounded={false} height="100%" padBottom={H - HALF} centerTo={centre}
        style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }}
        selectedShop={picked} onShop={pickOnMap}
        shops={list.filter((s) => s.lat != null && s.lng != null).map((s) => ({ id: s.vendor_id, lat: s.lat!, lng: s.lng!, label: s.name, logo: s.logo ?? null, price: s.price_from.bw != null ? `${formatNumber(s.price_from.bw, { maximumFractionDigits: 2 })} ${egp}` : s.name }))} />
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}
        style={{ position: 'absolute', top: insets.top + 8, start: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.md }}>
        <Icon name="forward" size={20} color={colors.textPrimary} />
      </TouchableOpacity>

      {/* «موقعي», riding above the sheet */}
      <Animated.View pointerEvents={stop === 'full' ? 'none' : 'auto'} style={[{ position: 'absolute', top: 0, end: spacing.lg }, locateStyle]}>
        <TouchableOpacity onPress={() => { if (here.me) setCentre({ ...here.me, nonce: Date.now() }); }} accessibilityRole="button" accessibilityLabel={t('print.my_location')} activeOpacity={0.85}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: here.me ? 1 : 0.55, ...shadows.md }}>
          <Icon name="gps" size={21} color={here.me ? colors.brand : colors.textTertiary} />
        </TouchableOpacity>
      </Animated.View>

      {/* the list sheet */}
      <Animated.View style={[{ position: 'absolute', start: 0, end: 0, top: 0, height: H, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadows.lg }, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: stop === 'full' ? insets.top + 4 : 8 }}>
            <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 8 }} />
            {searching ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 46 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSunken, paddingHorizontal: spacing.md }}>
                  <Icon name="search" size={16} color={colors.textTertiary} />
                  <TextInput value={query} onChangeText={setQuery} autoFocus placeholder={t('print.search_smart_ph')} placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, textAlign: 'right' }} returnKeyType="search"
                    autoCorrect={false} autoComplete="off" textContentType="none" spellCheck={false} />
                  {query ? <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button"><Icon name="close" size={15} color={colors.textTertiary} /></TouchableOpacity> : null}
                </View>
                <TouchableOpacity onPress={closeSearch} hitSlop={8} accessibilityRole="button">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.brand }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 46 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary }}>{t('print.shops_title')}</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{list.length ? t('print.shops_count', { n: formatNumber(list.length) }) : t('print.shops_sub')}</Text>
                </View>
                <TouchableOpacity onPress={openSearch} accessibilityRole="button" accessibilityLabel={t('print.search_ph')}
                  style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="search" size={19} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            )}
            <Surface id="teacher.print_shops.filters">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: spacing.sm }}>
              <Surface id="teacher.print_shops.sort">
              <TouchableOpacity onPress={() => setSorting(true)} activeOpacity={0.85} accessibilityRole="button" style={chip(sort !== 'recommended')}>
                <Icon name="list" size={14} color={sort !== 'recommended' ? colors.onPrimary : colors.textSecondary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: sort !== 'recommended' ? colors.onPrimary : colors.textSecondary }}>{t(`print.sort_${sort}`)}</Text>
                <Icon name="down" size={12} color={sort !== 'recommended' ? colors.onPrimary : colors.textTertiary} />
              </TouchableOpacity>
              </Surface>
              {FILTERS.map((c) => {
                const on = need.includes(c);
                return (
                  <TouchableOpacity key={c} onPress={() => toggle(c)} activeOpacity={0.85} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={chip(on)}>
                    {on ? <Icon name="success" size={13} color={colors.onPrimary} /> : null}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.onPrimary : colors.textSecondary }}>{caps[c] ?? c}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            </Surface>
          </View>
        </GestureDetector>

        <ScrollView ref={listRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          style={{ height: H - (stop === 'full' ? insets.top : HALF) - 124 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: insets.bottom + 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
          {/* suggestions while typing */}
          {suggestions.length ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: spacing.md, overflow: 'hidden', ...shadows.sm }}>
              {suggestions.map((sg, i) => (
                <TouchableOpacity key={`${sg.kind}-${i}`} onPress={() => take(sg)} activeOpacity={0.85} accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderLight }}>
                  {sg.kind === 'shop' ? <ShopLogo logo={sg.logo} size={34} /> : (
                    <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: sg.kind === 'sort' ? colors.brandTint : sg.kind === 'filter' ? colors.accentLight : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={SUGGEST_ICON[sg.kind]} size={16} color={sg.kind === 'sort' ? colors.brand : sg.kind === 'filter' ? colors.accentText : colors.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{suggestLabel(sg)}</Text>
                    {sg.kind === 'shop' && sg.sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>{sg.sub}</Text> : null}
                    {sg.kind === 'area' ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('print.suggest_area')}</Text> : null}
                  </View>
                  <Icon name="back" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {searching && !query.trim() ? (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('print.suggest_try')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[t('print.try_1'), t('print.try_2'), t('print.try_3'), t('print.try_4')].map((x) => (
                  <TouchableOpacity key={x} onPress={() => setQuery(x)} activeOpacity={0.85} accessibilityRole="button"
                    style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.surfaceSunken, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{x}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {shops.isLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
          {!shops.isLoading && list.length === 0 && (coming.length === 0 || !!query || need.length > 0) ? (
            <EmptyState icon="storefront" title={t('print.no_shops')} message={query || need.length ? t('print.no_match') : t('print.shops_empty')} />
          ) : (
            list.map((s) => (
              <Surface key={s.vendor_id} id="teacher.print_shops.shop" ctx={{ shop: s }}>
                <View onLayout={(e) => { cardY.current[s.vendor_id] = e.nativeEvent.layout.y; }}
                  style={picked === s.vendor_id ? { borderRadius: 24, borderWidth: 2, borderColor: colors.accent, padding: 2, marginBottom: spacing.sm } : null}>
                  <ShopCard s={s} labels={labels} caps={caps} egp={egp} />
                </View>
              </Surface>
            ))
          )}
          {coming.length > 0 && !query && !need.length ? (
            <Surface id="teacher.print_shops.coming">
            <View style={{ marginTop: list.length ? spacing.md : 0 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('print.coming_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm }}>{t('print.coming_sub')}</Text>
              {coming.map((c) => (
                <View key={c.vendor_id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: spacing.md, marginBottom: spacing.sm }}>
                  <ShopLogo logo={c.logo} size={40} muted />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{c.name}</Text>
                    {c.city ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{c.city}</Text> : null}
                  </View>
                  <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary }}>{t('print.coming_tag')}</Text>
                  </View>
                </View>
              ))}
            </View>
            </Surface>
          ) : null}
        </ScrollView>
      </Animated.View>

      {/* full page → see the map; dismissed → bring the list back */}
      {stop === 'full' && !searching ? (
        <TouchableOpacity onPress={() => go('gone')} activeOpacity={0.9} accessibilityRole="button" style={pill}>
          <Icon name="location" size={17} color={colors.background} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.background }}>{t('print.show_map')}</Text>
        </TouchableOpacity>
      ) : null}
      {stop === 'gone' ? (
        <TouchableOpacity onPress={() => go('half')} activeOpacity={0.9} accessibilityRole="button" style={pill}>
          <Icon name="list" size={17} color={colors.background} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.background }}>{t('print.show_list', { n: formatNumber(list.length) })}</Text>
        </TouchableOpacity>
      ) : null}

      {/* sorting — one chip, one small sheet */}
      <SheetModal visible={sorting} onClose={() => setSorting(false)}>
        <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.sm }}>{t('print.sort_title')}</Text>
          {SORTS.map((k) => (
            <TouchableOpacity key={k} onPress={() => { setSort(k); setSorting(false); }} accessibilityRole="radio" accessibilityState={{ selected: sort === k }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              <Text style={{ flex: 1, fontFamily: sort === k ? fonts.bold : fonts.medium, fontSize: 15, color: sort === k ? colors.brand : colors.textPrimary }}>{t(`print.sort_${k}`)}</Text>
              {sort === k ? <Icon name="success" size={18} color={colors.brand} /> : null}
            </TouchableOpacity>
          ))}
        </View>
      </SheetModal>
    </View>
    </Surface>
  );
}
