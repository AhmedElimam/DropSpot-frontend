import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormScreen } from '@/components/ui/Form';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber, foldForSearch } from '@/utils/format';
import { LiveMap } from '@/components/LiveMap';
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

/** One shop on the marketplace: who, what they can do, how fast they really are, what a page starts from. */
function ShopCard({ s, labels, caps, egp }: { s: MarketShop; labels: Record<string, string>; caps: Record<string, string>; egp: string }) {
  const { t } = useTranslation();
  const fresh = s.jobs_done === 0;
  const paused = !!s.paused_until && new Date(s.paused_until).getTime() > Date.now();
  return (
    <TouchableOpacity onPress={() => router.push(`/(teacher)/print/shops/${s.vendor_id}` as Href)} activeOpacity={0.85} accessibilityRole="button"
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden', opacity: paused ? 0.8 : 1 }}>
      {/* The shop's own work, first — the cover photo it chose. */}
      {s.cover ? (
        <View>
          <Image source={sampleSource(s.cover.url)} style={{ width: '100%', height: 132, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={150} recyclingKey={String(s.cover.id)} />
          <View style={{ position: 'absolute', top: 10, start: 10, flexDirection: 'row', gap: 6 }}>
            {paused ? <Tag text={t('print.paused_tag')} bg="rgba(10,14,39,0.78)" fg="#fff" /> : s.open_now === true ? <Tag text={t('print.open_now')} bg="rgba(31,147,102,0.92)" fg="#fff" /> : s.open_now === false ? <Tag text={t('print.closed_now')} bg="rgba(10,14,39,0.7)" fg="#fff" /> : null}
          </View>
          {(s.samples_count ?? 0) > 1 ? (
            <View style={{ position: 'absolute', bottom: 10, end: 10 }}><Tag text={t('print.photos_n', { n: formatNumber(s.samples_count ?? 0) })} bg="rgba(10,14,39,0.7)" fg="#fff" /></View>
          ) : null}
        </View>
      ) : null}
      <View style={{ padding: spacing.md }}>
      {!s.cover && (paused || s.open_now != null) ? (
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {paused ? <Tag text={t('print.paused_tag')} bg={colors.surfaceSunken} fg={colors.textSecondary} /> : <Tag text={t(s.open_now ? 'print.open_now' : 'print.closed_now')} bg={s.open_now ? colors.successLight : colors.surfaceSunken} fg={s.open_now ? colors.successText : colors.textSecondary} />}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: s.quality_tier === 'premium' ? colors.accent : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="storefront" size={24} color={s.quality_tier === 'premium' ? colors.onAccent : colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
            <Badges list={s.badges} labels={labels} />
          </View>
          {s.tagline ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textPrimary, marginTop: 2 }} numberOfLines={2}>{s.tagline}</Text> : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {[s.city, s.quality_label, s.ink_tech_label, s.distance_km != null ? t('print.km_away', { km: formatNumber(s.distance_km, { maximumFractionDigits: 1 }) }) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {s.price_from.bw != null ? (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{formatNumber(s.price_from.bw, { maximumFractionDigits: 2 })}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.textTertiary }}>{egp}{t('print.per_page_short')}</Text>
            </>
          ) : s.price_from.color != null ? (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{formatNumber(s.price_from.color, { maximumFractionDigits: 2 })}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.textTertiary }}>{t('print.color_short')}</Text>
            </>
          ) : null}
        </View>
      </View>

      {/* Standing: stars · real speed · on-time */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
        {s.rating != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Stars n={s.rating} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>{formatNumber(s.rating, { maximumFractionDigits: 1 })}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>({formatNumber(s.ratings)})</Text>
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.accentText }}>{t('print.new_shop')}</Text>
        )}
        <SpeedLine s={s} />
        {s.on_time_pct != null ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('print.on_time', { p: formatNumber(s.on_time_pct) })}</Text> : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}><Capabilities list={s.capabilities} labels={caps} /></View>
        {!fresh ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{t('print.jobs_done', { n: formatNumber(s.jobs_done) })}</Text> : null}
      </View>
      {s.open_jobs > 0 ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.warningDark, marginTop: 6 }}>{t('print.busy_now', { n: formatNumber(s.open_jobs) })}</Text>
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

/**
 * «اختر مطبعتك» — the marketplace, shop first (founder 2026-10-14: «like Uber or inDrive»).
 * Before any file exists the teacher sees every live shop as a driver card: capabilities,
 * reviews, measured speed, price-from, distance. Pick one and the job is built on ITS menu.
 */
export default function PrintShops() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shops = useQuery({ queryKey: ['print-shops'], queryFn: getPrintShops });
  const options = useQuery({ queryKey: ['print-options'], queryFn: getPrintOptions });
  const { refreshing, onRefresh } = usePullRefresh(shops.refetch);
  const [sort, setSort] = useState<Sort>('recommended');
  const [query, setQuery] = useState('');
  const [need, setNeed] = useState<string[]>([]);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [picked, setPicked] = useState<number | null>(null);

  // The filters a teacher actually asks for, in the order they ask.
  const FILTERS = ['color', 'delivery', 'rush', 'spiral', 'duplex', 'a5', 'bulk', 'laminate'];

  const list = useMemo(() => {
    const q = foldForSearch(query);
    const all = (shops.data?.shops ?? []).filter((s) => (!q || foldForSearch(`${s.name} ${s.city ?? ''} ${s.tagline ?? ''}`).includes(q)) && need.every((c) => s.capabilities.includes(c)));
    const by = <T,>(f: (s: MarketShop) => T | null | undefined, dir = 1) => [...all].sort((a, b) => {
      const x = f(a); const y = f(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
    switch (sort) {
      case 'nearest': return by((s) => s.distance_km);
      case 'fastest': return by((s) => s.speed_hours);
      case 'cheapest': return by((s) => s.price_from.bw ?? s.price_from.color);
      case 'top_rated': return by((s) => s.rating, -1);
      default: return all;
    }
  }, [shops.data, sort, query, need]);

  const coming = shops.data?.coming ?? [];
  const labels = options.data?.badges ?? {};
  const caps = options.data?.capabilities ?? {};
  const egp = t('teacher.egp');
  const onMap = list.filter((s) => s.lat != null && s.lng != null);
  const pickedShop = list.find((s) => s.vendor_id === picked) ?? null;
  const toggle = (c: string) => setNeed((n) => (n.includes(c) ? n.filter((x) => x !== c) : [...n, c]));

  const header = (
    <View>
      {/* search + list/map */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 44 }}>
          <Icon name="search" size={18} color={colors.textTertiary} />
          <TextInput value={query} onChangeText={setQuery} placeholder={t('print.search_ph')} placeholderTextColor={colors.textTertiary}
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, textAlign: 'right' }} returnKeyType="search" />
          {query ? <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button"><Icon name="close" size={16} color={colors.textTertiary} /></TouchableOpacity> : null}
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, padding: 3 }}>
          {(['list', 'map'] as const).map((v) => (
            <TouchableOpacity key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: view === v }}
              style={{ width: 40, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: view === v ? colors.brand : 'transparent' }}>
              <Icon name={v === 'list' ? 'list' : 'gps'} size={18} color={view === v ? colors.onPrimary : colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* what the job needs */}
      <Surface id="teacher.print_shops.filters">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: spacing.sm }}>
        {FILTERS.map((c) => {
          const on = need.includes(c);
          return (
            <TouchableOpacity key={c} onPress={() => toggle(c)} activeOpacity={0.85} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: on ? colors.accentLight : colors.surface, borderWidth: 1, borderColor: on ? colors.accent : colors.border }}>
              {on ? <Icon name="success" size={13} color={colors.accentText} /> : null}
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.accentText : colors.textSecondary }}>{caps[c] ?? c}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      </Surface>

      {view === 'list' ? (
        <Surface id="teacher.print_shops.sort">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: spacing.md }}>
          {SORTS.map((k) => {
            const on = sort === k;
            return (
              <TouchableOpacity key={k} onPress={() => setSort(k)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ height: 32, paddingHorizontal: 13, borderRadius: radius.full, justifyContent: 'center', backgroundColor: on ? colors.brand : 'transparent' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? colors.onPrimary : colors.textSecondary }}>{t(`print.sort_${k}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </Surface>
      ) : null}
    </View>
  );

  return (
    <Surface id="screen.teacher.print_shops" screen>
    <FormScreen title={t('print.shops_title')} subtitle={list.length ? t('print.shops_count', { n: formatNumber(list.length) }) : t('print.shops_sub')} scroll={false}>
      {shops.isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : view === 'map' ? (
        <View style={{ flex: 1, padding: spacing.lg, paddingBottom: 0 }}>
          {header}
          <Surface id="teacher.print_shops.map">
          <View style={{ flex: 1, marginBottom: insets.bottom + spacing.md }}>
            <LiveMap mapsKey={options.data?.maps_key} height="100%" style={{ flex: 1 }} selectedShop={picked} onShop={setPicked}
              shops={onMap.map((s) => ({ id: s.vendor_id, lat: s.lat!, lng: s.lng!, label: s.name, price: s.price_from.bw != null ? `${formatNumber(s.price_from.bw, { maximumFractionDigits: 2 })} ${egp}` : s.name }))} />
            {pickedShop ? (
              <View style={{ position: 'absolute', start: spacing.sm, end: spacing.sm, bottom: spacing.sm }}>
                <ShopCard s={pickedShop} labels={labels} caps={caps} egp={egp} />
              </View>
            ) : (
              <View style={{ position: 'absolute', alignSelf: 'center', bottom: spacing.md, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{onMap.length ? t('print.map_hint') : t('print.map_none')}</Text>
              </View>
            )}
          </View>
          </Surface>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
          {(shops.data?.shops ?? []).length ? header : null}
          {list.length === 0 && coming.length === 0 ? (
            <EmptyState icon="storefront" title={t('print.no_shops')} message={query || need.length ? t('print.no_match') : t('print.shops_empty')} />
          ) : (
            list.map((s) => (
              <Surface key={s.vendor_id} id="teacher.print_shops.shop" ctx={{ shop: s }}>
                <ShopCard s={s} labels={labels} caps={caps} egp={egp} />
              </Surface>
            ))
          )}
          {coming.length > 0 && !query && !need.length ? (
            <Surface id="teacher.print_shops.coming">
            <View style={{ marginTop: list.length ? spacing.lg : 0 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('print.coming_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm }}>{t('print.coming_sub')}</Text>
              {coming.map((c) => (
                <View key={c.vendor_id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="storefront" size={20} color={colors.textTertiary} />
                  </View>
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
      )}
    </FormScreen>
    </Surface>
  );
}
