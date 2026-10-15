import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, BackHandler, useWindowDimensions, type ScrollView as RNScrollView } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, ZoomIn, ZoomOut, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { distanceKm, parseQuery, shopMatches } from '@/utils/shopSearch';
import { MapSearch, type MapPick } from '@/components/print/MapSearch';
import { MapLocateControls } from '@/components/MapLocateControls';
import { ScrollView } from '@/components/ui/Refreshable';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing, radius, shadows, isDark } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber } from '@/utils/format';
import { LiveMap, MAP_BG, useMyLocation, type MapPoint } from '@/components/LiveMap';
import { useArrived } from '@/hooks/useArrived';
import { ShopLogo } from '@/components/print/ShopLogo';
import { Surface } from '@/ui/surfaces';
import { BetaLine } from '@/components/ui/Beta';
import { Image } from 'expo-image';
import { getPrintShops, getPrintOptions, sampleSource, type MarketShop, type FoundPlace } from '@/api/print';

type Sort = 'recommended' | 'nearest' | 'fastest' | 'cheapest' | 'top_rated';
const SORTS: Sort[] = ['recommended', 'nearest', 'fastest', 'cheapest', 'top_rated'];
/** The search bar's height over the map. */
const BAR = 48;

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

/** ★ 4.7 (23) | ⏱ 24 س | 📍 1.2 كم — the line a teacher decides on. `tight`: one line, no on-time. */
export function MetaLine({ s, tight = false }: { s: MarketShop; tight?: boolean }) {
  const { t } = useTranslation();
  // A thin bar, not «·»: beside Arabic digits a middle dot reads as a zero (٠).
  const dot = <View style={{ width: 1, height: 12, backgroundColor: colors.border }} />;
  const fs = tight ? 12 : 12.5;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: tight ? 'nowrap' : 'wrap', overflow: tight ? 'hidden' : 'visible' }}>
      {s.rating != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Icon name="star" size={13} color={colors.warning} />
          <Text style={{ fontFamily: fonts.bold, fontSize: fs, color: colors.textPrimary }}>{formatNumber(s.rating, { maximumFractionDigits: 1 })}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: fs - 0.5, color: colors.textTertiary }}>({formatNumber(s.ratings)})</Text>
        </View>
      ) : <Text style={{ fontFamily: fonts.bold, fontSize: fs - 0.5, color: colors.accentText }}>{t('print.new_shop_short')}</Text>}
      {dot}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Icon name="clock" size={13} color={s.speed_measured ? colors.success : colors.textTertiary} />
        <Text style={{ fontFamily: fonts.medium, fontSize: fs, color: s.speed_measured ? colors.successText : colors.textSecondary }}>{t('print.hours_short', { h: formatNumber(s.speed_hours) })}</Text>
      </View>
      {s.distance_km != null ? (
        <>
          {dot}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="location" size={13} color={colors.textTertiary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: fs, color: colors.textSecondary }}>{t('print.km_away', { km: formatNumber(s.distance_km, { maximumFractionDigits: 1 }) })}</Text>
          </View>
        </>
      ) : null}
      {!tight && s.on_time_pct != null ? <>{dot}<Text style={{ fontFamily: fonts.medium, fontSize: fs, color: colors.textSecondary }}>{t('print.on_time', { p: formatNumber(s.on_time_pct) })}</Text></> : null}
    </View>
  );
}

const isPaused = (s: Pick<MarketShop, 'paused_until'>) => !!s.paused_until && new Date(s.paused_until).getTime() > Date.now();

/** The price a page starts from, as a pill: «من ٠٫٥ ج/صفحة». */
function PricePill({ s }: { s: MarketShop }) {
  const { t } = useTranslation();
  const p = s.price_from.bw ?? s.price_from.color;
  if (p == null) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: colors.brandTint }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.brand }}>{t('print.from')}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{formatNumber(p, { maximumFractionDigits: 2 })}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.brand }}>{s.price_from.bw != null ? t('print.egp_page') : t('print.color_short')}</Text>
    </View>
  );
}

const THUMB_W = 92;
const THUMB_H = 112;

/**
 * One shop on the marketplace. Founder 2026-10-14: «each takes a huge portion of the page» —
 * so a row, not a poster (~130pt instead of ~360): the shop's own work as a rounded thumbnail
 * with its logo on the corner and what it is best at as a ribbon across the photo's foot;
 * beside it the name, open/closed with a dot and where, the decision line (★ rating (count) |
 * hours | km), then delivery-or-pickup and what it can do as chips that never wrap (the ones
 * that do not fit hide), and the price a page starts from as a pill.
 * `compact` is the card floating over the map for the shop tapped there.
 */
export function ShopCard({ s, labels, caps, compact = false }: { s: MarketShop; labels: Record<string, string>; caps: Record<string, string>; egp?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const paused = isPaused(s);
  const open = () => router.push(`/(teacher)/print/shops/${s.vendor_id}` as Href);
  const ribbon = s.badges[0];
  const tint = ribbon ? BADGE_TINT()[ribbon] : undefined;

  if (compact) {
    const state = paused ? t('print.paused_tag') : s.open_now === true ? t('print.open_now') : s.open_now === false ? t('print.closed_now') : null;
    const lit = !paused && s.open_now === true;
    return (
      <TouchableOpacity onPress={open} activeOpacity={0.9} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, ...shadows.lg }}>
        <ShopLogo logo={s.logo} size={54} premium={s.quality_tier === 'premium'} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
            {state ? <Tag text={state} bg={lit ? colors.successLight : colors.surfaceSunken} fg={lit ? colors.successText : colors.textSecondary} /> : null}
          </View>
          <MetaLine s={s} />
        </View>
        <PriceFrom s={s} size={18} />
      </TouchableOpacity>
    );
  }

  const state = paused ? { text: t('print.paused_tag'), fg: colors.warningText, dot: colors.warning }
    : s.open_now === true ? { text: t('print.open_now'), fg: colors.successText, dot: colors.success }
    : s.open_now === false ? { text: t('print.closed_now'), fg: colors.textTertiary, dot: colors.textTertiary } : null;
  // a shop with branches: the nearest one's name, where the distance is from
  const where = (s.branches_count ?? 0) > 1 && s.branch ? s.branch.name : s.city;
  const bar = <View style={{ width: 1, height: 11, backgroundColor: colors.border }} />;
  const chip = (key: string, text: string, icon: IconName | null, strong = false) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: strong ? colors.accentLight : colors.surfaceSunken, borderWidth: strong ? 0 : 1, borderColor: colors.borderLight }}>
      {icon ? <Icon name={icon} size={12} color={strong ? colors.accentText : colors.textSecondary} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: strong ? colors.accentText : colors.textSecondary }} numberOfLines={1}>{text}</Text>
    </View>
  );
  const others = s.capabilities.filter((c) => c !== 'delivery');

  return (
    <TouchableOpacity onPress={open} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel={[s.name, state?.text, ribbon ? labels[ribbon] : null].filter(Boolean).join('، ')}
      style={{ flexDirection: 'row', gap: spacing.md, padding: 10, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.borderLight, opacity: paused ? 0.85 : 1, ...shadows.sm }}>
      {/* the shop's own work, small, with its logo and its ribbon on it */}
      <View style={{ width: THUMB_W, height: THUMB_H, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
        {s.cover ? (
          <Image source={sampleSource(s.cover.url)} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} recyclingKey={String(s.cover.id)} />
        ) : (
          <LinearGradient colors={gradients.hero} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="print" size={30} color={colors.onHeroSoft} />
          </LinearGradient>
        )}
        <View style={{ position: 'absolute', top: 6, start: 6 }}>
          <ShopLogo logo={s.logo} size={32} premium={s.quality_tier === 'premium'} ring />
        </View>
        {(s.samples_count ?? 0) > 1 ? (
          <View style={{ position: 'absolute', top: 7, end: 6, flexDirection: 'row', alignItems: 'center', gap: 2, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: 'rgba(10,14,39,0.6)' }}>
            <Icon name="images" size={10} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 9.5, color: '#fff' }}>{formatNumber(s.samples_count ?? 0)}</Text>
          </View>
        ) : null}
        {ribbon ? (
          <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 4, backgroundColor: tint?.bg ?? colors.surface }}>
            <Icon name={BADGE_ICON[ribbon] ?? 'trophy'} size={11} color={tint?.fg ?? colors.textPrimary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: tint?.fg ?? colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{labels[ribbon] ?? ribbon}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 1 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
          {state || where ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {state ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: state.dot }} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: state.fg }}>{state.text}</Text>
                </View>
              ) : null}
              {state && where ? bar : null}
              {where ? <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary, flexShrink: 1 }} numberOfLines={1}>{where}</Text> : null}
            </View>
          ) : null}
        </View>
        <MetaLine s={s} tight />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* one line of chips: the ones that do not fit wrap onto a hidden second line */}
          <View style={{ flex: 1, height: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 4, overflow: 'hidden' }}>
            {s.delivery
              ? chip('d', s.delivery_fee > 0 ? t('print.delivery_chip', { p: formatNumber(s.delivery_fee, { maximumFractionDigits: 2 }) }) : t('print.free_delivery'), 'delivery', true)
              : chip('p', t('print.pickup_chip'), 'storefront')}
            {others.slice(0, 2).map((c) => chip(c, caps[c] ?? c, null))}
          </View>
          <PricePill s={s} />
        </View>
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

/**
 * Filters (founder 2026-10-14: «filters needs to be multi-selected»): every key is ANDed. Most
 * are the shop's capability keys from the server; these three are read off the shop itself.
 */
const FLAG_TEST: Record<string, (s: MarketShop) => boolean> = {
  open_now: (s) => s.open_now === true && !isPaused(s),
  pickup: (s) => s.pickup,
  rating4: (s) => (s.rating ?? 0) >= 4,
};
const passes = (s: MarketShop, k: string) => (FLAG_TEST[k] ? FLAG_TEST[k](s) : s.capabilities.includes(k));
/** The chips on the sheet's header, in the order a teacher asks for them. */
const QUICK = ['open_now', 'delivery', 'color', 'duplex', 'spiral', 'rush', 'a5', 'laminate'];
/** «الفلاتر» — every filter, grouped. */
const GROUPS: { key: 'service' | 'print' | 'finish' | 'shop'; items: string[] }[] = [
  { key: 'service', items: ['open_now', 'delivery', 'pickup', 'rush'] },
  { key: 'print', items: ['color', 'color_hq', 'duplex', 'a5', 'a3', 'glossy', 'heavy', 'special_paper'] },
  { key: 'finish', items: ['spiral', 'staple', 'glue', 'punch', 'laminate', 'cover'] },
  { key: 'shop', items: ['rating4', 'bulk', 'extras'] },
];
const EASE = { duration: 220, easing: Easing.out(Easing.cubic) };

/** A multi-select chip: toggles on its own, a check mark pops in when on. */
function FilterChip({ on, label, onPress, count, disabled = false, icon }: { on: boolean; label: string; onPress: () => void; count?: number; disabled?: boolean; icon?: IconName }) {
  const fg = on ? colors.onPrimary : colors.textSecondary;
  return (
    <Animated.View layout={LinearTransition.duration(180)}>
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border, opacity: disabled ? 0.4 : 1 }}>
        {on ? (
          <Animated.View entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(120)}><Icon name="success" size={14} color={colors.onPrimary} /></Animated.View>
        ) : icon ? <Icon name={icon} size={14} color={fg} /> : null}
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: fg }}>{label}</Text>
        {/* how many shops it leaves — a little pill, so a lone «١» never reads as a stray bar */}
        {count != null ? (
          <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.22)' : colors.surfaceSunken }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 14, color: on ? colors.onPrimary : colors.textSecondary }}>{formatNumber(count)}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * «اختر مطبعتك» — the marketplace, shop first (founder 2026-10-14: «like Uber or inDrive»).
 * The map fills the page; the list is a sheet over it with TWO stops (founder 2026-10-14:
 * «two stops: half + full page»): half (the map above it) and the whole page. Dragged down
 * from half it is dismissed — the whole map, and a «القائمة» pill to bring it back; on the
 * full page a «الخريطة» pill does the same. «موقعي» rides just above the sheet, never under
 * it. Search reads what she means (src/utils/shopSearch.ts) and suggests while she types.
 *
 * The search is a bar ON the map (founder 2026-10-14: «there's no search on map — we want maps
 * search to be smart»): shops, areas, her own places and any street or school
 * (components/print/MapSearch.tsx). A place becomes the centre: the map flies there and the
 * shops come nearest-to-it first. On the full page the bar's arrow brings the map back
 * (founder: «no fast button to go back»), and so does Android's back.
 *
 * The bar folds (founder 2026-10-14: «make the searchbar toggleable with smooth transition»):
 * dragging the map, or its own fold button, shrinks it into a round search button beside the
 * back arrow, and a tap opens it again. While a search or a place is on, and on the full page
 * where it is the header, it stays open.
 */
export default function PrintShops() {
  // The map is a WebView: build it once the push has finished sliding, not inside the
  // tap's first frame (the stack starts the animation only after the first render).
  const arrived = useArrived();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: H, width: W } = useWindowDimensions();
  const shops = useQuery({ queryKey: ['print-shops'], queryFn: getPrintShops });
  const options = useQuery({ queryKey: ['print-options'], queryFn: getPrintOptions });
  const { refreshing, onRefresh } = usePullRefresh(shops.refetch);
  const [sort, setSort] = useState<Sort>('recommended');
  const [sorting, setSorting] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // Capability keys and the FLAG_TEST keys, all ANDed.
  const [need, setNeed] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [place, setPlace] = useState<FoundPlace | null>(null);
  const [following, setFollowing] = useState(false);
  const [stop, setStop] = useState<'half' | 'full' | 'gone'>('half');
  const [centre, setCentre] = useState<(MapPoint & { nonce: number; zoom?: number }) | null>(null);
  const [barOpen, setBarOpen] = useState(true);
  const [headH, setHeadH] = useState(140);
  const here = useMyLocation(true);
  const listRef = useRef<RNScrollView>(null);
  const cardY = useRef<Record<number, number>>({});

  const caps = options.data?.capabilities ?? {};
  const labels = options.data?.badges ?? {};
  const all = shops.data?.shops ?? [];
  const parsed = useMemo(() => parseQuery(query, caps), [query, caps]);

  // What the search leaves, before the filters: the filter sheet counts against it.
  const base = useMemo(() => {
    // Searching for a place makes it the centre: how far each shop is from THERE.
    // …from its nearest branch to there.
    const from = place ? all.map((s) => {
      const pts = s.points?.length ? s.points.map(([lat, lng]) => ({ lat, lng })) : s.lat != null && s.lng != null ? [{ lat: s.lat, lng: s.lng }] : [];
      if (!pts.length) return s;
      const near = pts.reduce((a, b) => (distanceKm(place, b) < distanceKm(place, a) ? b : a));
      // the pin on the map moves to that branch too
      return { ...s, lat: near.lat, lng: near.lng, distance_km: Math.round(distanceKm(place, near) * 10) / 10 };
    }) : all;
    return from.filter((s) => shopMatches(s, parsed, caps));
  }, [all, parsed, caps, place]);

  const order = sort !== 'recommended' ? sort : parsed.sort ?? (place ? 'nearest' : 'recommended');
  const list = useMemo(() => {
    const hits = base.filter((s) => need.every((k) => passes(s, k)));
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
  }, [base, need, order]);
  const openCount = useMemo(() => list.filter((s) => FLAG_TEST.open_now(s)).length, [list]);
  // How many shops each option would leave, with the others kept — only while the sheet is up.
  const facet = useMemo(() => {
    if (!filtering) return {} as Record<string, number>;
    const out: Record<string, number> = {};
    for (const g of GROUPS) for (const k of g.items) out[k] = base.filter((s) => passes(s, k) && need.every((n) => n === k || passes(s, n))).length;
    return out;
  }, [filtering, base, need]);

  const coming = shops.data?.coming ?? [];
  const egp = t('teacher.egp');
  const toggle = (c: string) => setNeed((n) => (n.includes(c) ? n.filter((x) => x !== c) : [...n, c]));
  const filterLabel = (k: string) => (k === 'open_now' ? t('print.open_now') : k === 'pickup' ? t('print.pickup_chip') : k === 'rating4' ? t('print.filter_rating', { n: formatNumber(4) }) : caps[k] ?? k);
  const known = (k: string) => !!FLAG_TEST[k] || !!caps[k];
  const groupTitle: Record<(typeof GROUPS)[number]['key'], string> = {
    service: t('print.filter_group_service'), print: t('print.filter_group_print'), finish: t('print.filter_group_finish'), shop: t('print.filter_group_shop'),
  };
  // Filters picked in the sheet that are not quick chips come first, so every active one shows.
  const quick = [...need.filter((k) => !QUICK.includes(k)), ...QUICK.filter(known)];

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
  // «موقعي» sits 14 above the sheet's top (its two buttons are 102 tall), and fades out on
  // the full page. It rides the sheet's TOP edge, so the header's height never moves it.
  const locateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(y.value, H - insets.bottom - 24) - 116 }],
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
  // What the search page hands back: each lands on the map.
  const [draft, setDraft] = useState('');
  const openSearch = () => { setDraft(query); setSearching(true); };
  const take = (p: MapPick) => {
    setSearching(false);
    setFollowing(false); // going somewhere else stops following the phone
    if (p.kind === 'sort') { setSort(p.key as Sort); setQuery(''); }
    else if (p.kind === 'filter') { if (!need.includes(p.key)) toggle(p.key); setQuery(''); }
    else if (p.kind === 'area' || p.kind === 'text') { setQuery(p.kind === 'area' ? p.text : p.text); setPicked(null); if (stop === 'gone') go('half'); }
    else if (p.kind === 'near_me') { setPlace(null); setQuery(''); setSort('nearest'); if (here.me) setCentre({ ...here.me, zoom: 14, nonce: Date.now() }); if (stop !== 'half') go('half'); }
    else if (p.kind === 'place') { setPlace(p.place); setQuery(''); setPicked(null); setCentre({ lat: p.place.lat, lng: p.place.lng, zoom: 14, nonce: Date.now() }); go('half'); listRef.current?.scrollTo({ y: 0, animated: false }); }
    else {
      // a shop: fly to it, light it up, and bring its card into view
      const s = all.find((x) => x.vendor_id === p.id);
      setQuery('');
      if (s?.lat != null && s?.lng != null) setCentre({ lat: s.lat, lng: s.lng, zoom: 15, nonce: Date.now() });
      if (stop === 'full') go('half');
      pickOnMap(p.id);
    }
  };
  const clearSearch = () => { setQuery(''); setPlace(null); };
  const searchText = place?.name ?? query;

  // ── the search bar: open, or folded into a round button ──────────────────────────────
  const expanded = barOpen || !!searchText || stop === 'full';
  const BAR_FULL = W - spacing.lg * 2 - BAR - 8;
  const barV = useSharedValue(1);
  useEffect(() => { barV.value = withTiming(expanded ? 1 : 0, EASE); }, [expanded, barV]);
  const barStyle = useAnimatedStyle(() => ({ width: BAR + (BAR_FULL - BAR) * barV.value }));
  // the words fade and slide toward the button they fold into (RTL: the start is the right)
  const barInside = useAnimatedStyle(() => ({
    opacity: Math.max(0, (barV.value - 0.35) / 0.65),
    transform: [{ translateX: (1 - barV.value) * 16 }],
  }));

  // Back: the search page, then the full list, then leave.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (searching) { setSearching(false); return true; }
      if (stop === 'full') { go('half'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [searching, stop]);
  const chip = (on: boolean) => ({ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border });
  const pill = { position: 'absolute' as const, alignSelf: 'center' as const, bottom: insets.bottom + spacing.lg, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, height: 46, paddingHorizontal: 20, borderRadius: 23, backgroundColor: colors.textPrimary, ...shadows.lg };
  const filtered = need.length > 0;
  const sub = place ? t('print.map_near_place', { n: formatNumber(list.length), place: place.name })
    : filtered || query ? t('print.shops_count_of', { n: formatNumber(list.length), total: formatNumber(all.length) })
    : t('print.shops_sub');
  const sortIcon = <Icon name="transfer" size={14} color={sort !== 'recommended' ? colors.onPrimary : colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />;

  return (
    <Surface id="screen.teacher.print_shops" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark() ? 'light' : 'dark'} />
      {/* the map, the whole page */}
      {!arrived ? <View style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0, backgroundColor: MAP_BG[isDark() ? 'dark' : 'light'] }} /> : null}
      {arrived ? <LiveMap mapsKey={options.data?.maps_key} showMe hideLocate rounded={false} height="100%" padBottom={H - HALF} centerTo={centre}
        refitKey={`${query}|${need.join(',')}`} followMe={following} onDragMap={() => { setFollowing(false); setBarOpen(false); }}
        dest={place ? { lat: place.lat, lng: place.lng, label: place.name } : null}
        style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }}
        selectedShop={picked} onShop={pickOnMap}
        shops={list.filter((s) => s.lat != null && s.lng != null).map((s) => ({ id: s.vendor_id, lat: s.lat!, lng: s.lng!, label: s.name, logo: s.logo ?? null, price: s.price_from.bw != null ? `${formatNumber(s.price_from.bw, { maximumFractionDigits: 2 })} ${egp}` : s.name }))} /> : null}

      {/* live tracking over «موقعي», riding above the sheet */}
      <Animated.View pointerEvents={stop === 'full' ? 'none' : 'auto'} style={[{ position: 'absolute', top: 0, end: spacing.lg }, locateStyle]}>
        <MapLocateControls hasFix={!!here.me} following={following} onFollow={() => setFollowing((f) => !f)}
          onLocate={() => { if (here.me) setCentre({ ...here.me, nonce: Date.now() }); }} />
      </Animated.View>

      {/* the list sheet */}
      <Animated.View style={[{ position: 'absolute', start: 0, end: 0, top: 0, height: H, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadows.lg }, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View onLayout={(e) => setHeadH(Math.round(e.nativeEvent.layout.height))}
            style={{ paddingTop: stop === 'full' ? insets.top + BAR + 14 : 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
            <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 10 }} />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('print.shops_title')}</Text>
                {!shops.isLoading ? (
                  <Animated.View key={list.length} entering={ZoomIn.duration(180)}
                    style={{ minWidth: 26, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{formatNumber(list.length)}</Text>
                  </Animated.View>
                ) : null}
                <View style={{ flex: 1 }} />
                {openCount > 0 ? (
                  <TouchableOpacity onPress={() => toggle('open_now')} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked: need.includes('open_now') }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.successLight, borderWidth: need.includes('open_now') ? 1 : 0, borderColor: colors.success }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.successText }}>{t('print.strip_open_now', { n: formatNumber(openCount) })}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
              <BetaLine feature="print_market" style={{ marginHorizontal: 0, marginTop: spacing.sm }} />
            </View>
            <Surface id="teacher.print_shops.filters">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 10, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
              {/* every filter, grouped, in a sheet */}
              <TouchableOpacity onPress={() => setFiltering(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('print.filters_title')} style={chip(filtered)}>
                <Icon name="filter" size={14} color={filtered ? colors.onPrimary : colors.textSecondary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: filtered ? colors.onPrimary : colors.textSecondary }}>{t('print.filters_title')}</Text>
                {filtered ? (
                  <Animated.View key={need.length} entering={ZoomIn.duration(160)}
                    style={{ minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.onPrimary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.brand }}>{formatNumber(need.length)}</Text>
                  </Animated.View>
                ) : null}
              </TouchableOpacity>
              <Surface id="teacher.print_shops.sort">
              <TouchableOpacity onPress={() => setSorting(true)} activeOpacity={0.8} accessibilityRole="button" style={chip(sort !== 'recommended')}>
                {sortIcon}
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: sort !== 'recommended' ? colors.onPrimary : colors.textSecondary }}>{t(`print.sort_${sort}`)}</Text>
                <Icon name="down" size={12} color={sort !== 'recommended' ? colors.onPrimary : colors.textTertiary} />
              </TouchableOpacity>
              </Surface>
              <View style={{ width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 2 }} />
              {quick.map((c) => <FilterChip key={c} on={need.includes(c)} label={filterLabel(c)} onPress={() => toggle(c)} />)}
              {filtered ? (
                <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
                  <TouchableOpacity onPress={() => setNeed([])} activeOpacity={0.7} accessibilityRole="button" style={{ height: 34, paddingHorizontal: 8, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>{t('print.filter_clear_all')}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : null}
            </ScrollView>
            </Surface>
          </View>
        </GestureDetector>

        <ScrollView ref={listRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          style={{ height: H - (stop === 'full' ? 0 : HALF) - headH }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
          {shops.isLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
          {!shops.isLoading && list.length > 0 ? (
            // what the list is sorted by, as a quiet separator above it
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
              <Icon name="transfer" size={12} color={colors.textTertiary} style={{ transform: [{ rotate: '90deg' }] }} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }}>{t('print.sorted_by', { s: t(`print.sort_${order}`) })}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.borderLight }} />
            </View>
          ) : null}
          {!shops.isLoading && list.length === 0 && (coming.length === 0 || !!query || filtered) ? (
            <View style={{ alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.lg, gap: 6 }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={query || filtered || place ? 'search' : 'storefront'} size={28} color={colors.brand} />
                </View>
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, textAlign: 'center' }}>{query || filtered ? t('print.no_match_title') : t('print.no_shops')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>{query || filtered ? t('print.no_match') : t('print.shops_empty')}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                {filtered ? (
                  <TouchableOpacity onPress={() => setNeed([])} activeOpacity={0.85} accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: colors.brand }}>
                    <Icon name="close" size={14} color={colors.onPrimary} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onPrimary }}>{t('print.clear_filters')}</Text>
                  </TouchableOpacity>
                ) : null}
                {searchText ? (
                  <TouchableOpacity onPress={clearSearch} activeOpacity={0.85} accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 16, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                    <Icon name="search" size={14} color={colors.textSecondary} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('print.map_clear')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : (
            list.map((s) => (
              <Surface key={s.vendor_id} id="teacher.print_shops.shop" ctx={{ shop: s }}>
                <Animated.View entering={FadeIn.duration(180)} onLayout={(e) => { cardY.current[s.vendor_id] = e.nativeEvent.layout.y; }}
                  style={[{ marginBottom: spacing.sm }, picked === s.vendor_id ? { borderRadius: 23, borderWidth: 2, borderColor: colors.accent, padding: 2 } : null]}>
                  <ShopCard s={s} labels={labels} caps={caps} egp={egp} />
                </Animated.View>
              </Surface>
            ))
          )}
          {coming.length > 0 && !query && !filtered ? (
            <Surface id="teacher.print_shops.coming">
            <View style={{ marginTop: list.length ? spacing.md : 0 }}>
              {list.length ? <View style={{ height: 1, backgroundColor: colors.borderLight, marginBottom: spacing.md }} /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="clock" size={16} color={colors.accentText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('print.coming_title')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('print.coming_sub')}</Text>
                </View>
              </View>
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

      {/* the search bar, on the map — and over the full list, where its arrow brings the map back */}
      <View style={{ position: 'absolute', top: insets.top + 8, start: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity onPress={() => (stop === 'full' ? go('half') : router.back())} accessibilityRole="button" accessibilityLabel={stop === 'full' ? t('print.show_map') : t('common.back')}
          style={{ width: BAR, height: BAR, borderRadius: BAR / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.md }}>
          <Icon name={stop === 'full' ? 'down' : 'forward'} size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Surface id="teacher.print_shops.search">
        <Animated.View style={[{ height: BAR, borderRadius: BAR / 2, backgroundColor: colors.surface, ...shadows.md }, barStyle]}>
          <TouchableOpacity onPress={expanded ? openSearch : () => setBarOpen(true)} activeOpacity={0.9}
            accessibilityRole={expanded ? 'search' : 'button'} accessibilityLabel={expanded ? undefined : t('print.search_show')}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: BAR / 2, overflow: 'hidden' }}>
            <View style={{ width: BAR, height: BAR, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={place ? 'pin' : 'search'} size={19} color={place ? colors.danger : colors.brand} />
            </View>
            {/* a fixed width: the words are clipped as the bar folds, never re-wrapped */}
            <Animated.View pointerEvents={expanded ? 'auto' : 'none'} style={[{ width: BAR_FULL - BAR, flexDirection: 'row', alignItems: 'center', gap: 6, paddingEnd: 7 }, barInside]}>
              <Text style={{ flex: 1, fontFamily: searchText ? fonts.bold : fonts.regular, fontSize: 14.5, color: searchText ? colors.textPrimary : colors.textTertiary }} numberOfLines={1}>
                {searchText || t('print.map_search_ph')}
              </Text>
              {searchText ? (
                <TouchableOpacity onPress={clearSearch} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('print.map_clear')}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={15} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : stop !== 'full' ? (
                // fold the bar into its round button — the map to herself
                <TouchableOpacity onPress={() => setBarOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('print.search_hide')}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
        </Surface>
      </View>

      {searching ? (
        <MapSearch query={draft} onQuery={setDraft} onClose={() => setSearching(false)} onPick={take}
          shops={all} caps={caps} venues={options.data?.destinations ?? []} me={here.me} />
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

      {/* «الفلاتر» — every filter, grouped, each one on its own; the list updates behind */}
      <SheetModal visible={filtering} onClose={() => setFiltering(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('print.filters_title')}</Text>
          <TouchableOpacity onPress={() => setNeed([])} disabled={!filtered} hitSlop={8} accessibilityRole="button" style={{ opacity: filtered ? 1 : 0.4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>{t('print.filter_clear_all')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: H * 0.56, flexGrow: 0 }} contentContainerStyle={{ paddingBottom: spacing.sm }}>
          {GROUPS.map((g) => {
            const items = g.items.filter(known);
            if (!items.length) return null;
            return (
              <View key={g.key} style={{ paddingVertical: spacing.sm, borderTopWidth: g.key === 'service' ? 0 : 1, borderTopColor: colors.borderLight }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textTertiary, marginBottom: spacing.sm }}>{groupTitle[g.key]}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {items.map((k) => {
                    const on = need.includes(k);
                    return <FilterChip key={k} on={on} label={filterLabel(k)} count={facet[k]} disabled={!on && facet[k] === 0} onPress={() => toggle(k)} />;
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={() => setFiltering(false)} activeOpacity={0.9} accessibilityRole="button"
          style={{ height: 50, borderRadius: 25, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: list.length ? colors.brand : colors.surfaceSunken }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: list.length ? colors.onPrimary : colors.textSecondary }}>
            {list.length ? t('print.filter_show', { n: formatNumber(list.length) }) : t('print.filter_show_none')}
          </Text>
        </TouchableOpacity>
      </SheetModal>
    </View>
    </Surface>
  );
}
