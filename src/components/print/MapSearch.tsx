import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ShopLogo } from '@/components/print/ShopLogo';
import { formatNumber } from '@/utils/format';
import { distanceKm, matchPlaces, parseQuery, suggest, type SearchableShop, type Suggestion } from '@/utils/shopSearch';
import { searchPlaces, type Destination, type FoundPlace } from '@/api/print';

/** What a row in the search page does when tapped. */
export type MapPick =
  | Suggestion
  | { kind: 'place'; place: FoundPlace }
  | { kind: 'near_me' }
  | { kind: 'text'; text: string };

/** Words a place could be named by — what is left once a sort or a need is read out. */
const placeWords = (q: string, caps: Record<string, string>) => parseQuery(q, caps).rest.join('').length >= 3;

const ICON: Record<string, IconName> = { sort: 'list', filter: 'success', area: 'location', place: 'pin', venue: 'book', near_me: 'gps' };

/** One line of the search page's list. */
type Line =
  | { key: string; kind: 'head'; text: string }
  | { key: string; kind: 'pick'; icon?: IconName; tint?: { bg: string; fg: string }; logo?: string | null; isShop?: boolean; title: string; sub?: string | null; end?: string | null; pick: MapPick }
  | { key: string; kind: 'tries' | 'wait' | 'ask' }
  | { key: string; kind: 'note'; text: string };
const lineKey = (l: Line) => l.key;

/** A result: its icon (or the shop's logo), its name, a line under it, how far it is. */
const PickRow = memo(function PickRow({ line, onPick }: { line: Extract<Line, { kind: 'pick' }>; onPick: (p: MapPick) => void }) {
  const { icon, tint, logo, isShop, title, sub, end } = line;
  return (
    <TouchableOpacity onPress={() => onPick(line.pick)} activeOpacity={0.85} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 11 }}>
      {isShop ? <ShopLogo logo={logo ?? null} size={38} /> : (
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: tint?.bg ?? colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon ?? 'location'} size={17} color={tint?.fg ?? colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {end ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{end}</Text> : null}
    </TouchableOpacity>
  );
});

function Head({ text }: { text: string }) {
  return <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.md, marginBottom: 2 }}>{text}</Text>;
}

/** «جرّب»: four fixed examples of what the search understands; a tap types one. */
function TryChips({ onQuery }: { onQuery: (q: string) => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {[t('print.try_1'), t('print.try_2'), t('print.try_3'), t('print.try_place')].map((x) => (
        <TouchableOpacity key={x} onPress={() => onQuery(x)} activeOpacity={0.85} accessibilityRole="button"
          style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.surfaceSunken, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{x}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * The map's search, Google-Maps style (founder 2026-10-14: «there's no search on map — we want
 * maps search to be smart»): the bar over the map opens this page. While she types it offers,
 * at once and from the phone, what her words mean (a sort, a need), the shops and areas that
 * match, and her own places (centres, schools); and places on the map — streets, schools,
 * squares — from the server after every short pause (founder 2026-10-14: «the map search
 * doesn't work»: it used to ask only when no shop matched, and Arabic's loose matching
 * nearly always found one). The last answer stays while she keeps typing. Places come
 * nearest-first, with how far they are.
 */
export function MapSearch({ query, onQuery, onClose, onPick, shops, caps, venues, me }: {
  query: string; onQuery: (q: string) => void; onClose: () => void; onPick: (p: MapPick) => void;
  shops: SearchableShop[]; caps: Record<string, string>; venues: Destination[]; me: { lat: number; lng: number } | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const q = query.trim();
  const [asked, setAsked] = useState('');

  const local = useMemo(() => (q ? suggest(q, shops, caps) : []), [q, shops, caps]);
  const mine = useMemo(() => (q ? matchPlaces(q, venues).slice(0, 3) : []), [q, venues]);
  // Ask the map after every short pause (3+ letters, words left over once a sort/need is read).
  const lookup = useMemo(() => q.length >= 3 && placeWords(q, caps), [q, caps]);
  useEffect(() => {
    if (!lookup) return;
    const timer = setTimeout(() => setAsked(q), 650);
    return () => clearTimeout(timer);
  }, [q, lookup]);
  const near = me ? { lat: Math.round(me.lat * 10) / 10, lng: Math.round(me.lng * 10) / 10 } : null;
  const places = useQuery({
    queryKey: ['print-places', asked, near?.lat, near?.lng],
    queryFn: () => searchPlaces(asked, near),
    enabled: asked.length >= 2,
    staleTime: 10 * 60_000,
    placeholderData: (prev) => prev,   // keep the last places while the next ones come
  });
  const showPlaces = asked.length >= 2 && q.length >= 2;
  const found = useMemo(() => {
    const list = places.data ?? [];
    return me ? [...list].sort((a, b) => distanceKm(me, a) - distanceKm(me, b)) : list;
  }, [places.data, me]);
  const askNow = () => { if (q.length >= 2) setAsked(q); };
  const submit = () => {
    // Shops answer it → show them on the map; otherwise look for a place by that name.
    // A place answer that names it closely wins; else shops answer it; else ask the map now.
    const top = found[0];
    if (top && !local.some((s) => s.kind === 'shop' || s.kind === 'area')) { Keyboard.dismiss(); onPick({ kind: 'place', place: top }); }
    else if (local.some((s) => s.kind === 'shop' || s.kind === 'area' || s.kind === 'sort' || s.kind === 'filter')) { Keyboard.dismiss(); onPick({ kind: 'text', text: q }); }
    else askNow();
  };

  const label = (sg: Suggestion) => (sg.kind === 'sort' ? t('print.suggest_sort', { s: t(`print.sort_${sg.key}`) })
    : sg.kind === 'filter' ? t('print.suggest_filter', { c: caps[sg.key] ?? sg.key })
    : sg.kind === 'area' ? sg.text : sg.name);
  const km = (p: { lat: number; lng: number }) => (me ? t('print.km_away', { km: formatNumber(distanceKm(me, p), { maximumFractionDigits: 1 }) }) : null);

  const shopRows = local.filter((s): s is Extract<Suggestion, { kind: 'shop' }> => s.kind === 'shop');
  const intentRows = local.filter((s) => s.kind === 'sort' || s.kind === 'filter');
  const areaRows = local.filter((s): s is Extract<Suggestion, { kind: 'area' }> => s.kind === 'area');

  // Everything under the bar is ONE windowed list: each line below is a row of it.
  const lines = useMemo<Line[]>(() => {
    const venueTint = { bg: colors.accentLight, fg: colors.accentText };
    const venueLine = (key: string, v: Destination): Line => ({ key, kind: 'pick', icon: ICON.venue, tint: venueTint, title: v.name, sub: v.address, end: km(v), pick: { kind: 'place', place: { name: v.name, sub: v.address, lat: v.lat, lng: v.lng } } });
    if (!q) {
      return [
        ...(me ? [{ key: 'near', kind: 'pick' as const, icon: ICON.near_me, tint: { bg: colors.brandTint, fg: colors.brand }, title: t('print.map_near_me'), sub: t('print.map_near_me_sub'), pick: { kind: 'near_me' as const } }] : []),
        ...(venues.length ? [{ key: 'h-venues', kind: 'head' as const, text: t('print.map_your_places') }] : []),
        ...venues.slice(0, 5).map((v) => venueLine(`v${v.id}`, v)),
        { key: 'h-try', kind: 'head', text: t('print.suggest_try') },
        { key: 'tries', kind: 'tries' },
      ];
    }
    const tints = { sort: { bg: colors.brandTint, fg: colors.brand }, filter: { bg: colors.accentLight, fg: colors.accentText } };
    return [
      ...intentRows.map((sg, i): Line => ({ key: `i${i}`, kind: 'pick', icon: ICON[sg.kind], tint: tints[sg.kind as 'sort' | 'filter'], title: label(sg), pick: sg })),
      ...(shopRows.length ? [{ key: 'h-shops', kind: 'head' as const, text: t('print.map_shops') }] : []),
      ...shopRows.map((sg): Line => {
        const s = shops.find((x) => x.vendor_id === sg.id) as (SearchableShop & { lat?: number | null; lng?: number | null }) | undefined;
        return { key: `s${sg.id}`, kind: 'pick', isShop: true, logo: sg.logo, title: sg.name, sub: sg.sub, end: s?.lat != null && s?.lng != null ? km({ lat: s.lat, lng: s.lng }) : null, pick: sg };
      }),
      ...(areaRows.length ? [{ key: 'h-areas', kind: 'head' as const, text: t('print.map_areas') }] : []),
      ...areaRows.map((sg): Line => ({ key: `a${sg.text}`, kind: 'pick', icon: ICON.area, title: sg.text, sub: t('print.suggest_area'), pick: sg })),
      ...(mine.length ? [{ key: 'h-mine', kind: 'head' as const, text: t('print.map_your_places') }] : []),
      ...mine.map((v) => venueLine(`v${v.id}`, v)),
      // places on the map
      ...(showPlaces && (places.isFetching || found.length || places.isFetched) ? [{ key: 'h-places', kind: 'head' as const, text: t('print.map_places') }] : []),
      ...(showPlaces && places.isFetching && !found.length ? [{ key: 'wait', kind: 'wait' as const }] : []),
      ...(showPlaces ? found.map((p, i): Line => ({ key: `p${i}`, kind: 'pick', icon: ICON.place, tint: { bg: colors.dangerLight, fg: colors.danger }, title: p.name, sub: p.sub, end: km(p), pick: { kind: 'place', place: p } })) : []),
      ...(showPlaces && asked === q && places.isFetched && !places.isFetching && !found.length
        ? [{ key: 'none', kind: 'note' as const, text: places.isError ? t('print.map_places_failed') : t('print.map_no_place') }] : []),
      ...(!lookup && asked !== q && q.length >= 2 ? [{ key: 'ask', kind: 'ask' as const }] : []),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, me, venues, local, mine, shops, caps, showPlaces, found, places.isFetching, places.isFetched, places.isError, asked, lookup, t]);

  const renderLine = useCallback(({ item }: { item: Line }) => {
    switch (item.kind) {
      case 'head': return <Head text={item.text} />;
      case 'pick': return <PickRow line={item} onPick={onPick} />;
      case 'tries': return <TryChips onQuery={onQuery} />;
      case 'wait': return <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />;
      case 'note': return <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginVertical: spacing.sm }}>{item.text}</Text>;
      default: return (
        <TouchableOpacity onPress={askNow} activeOpacity={0.85} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="search" size={17} color={colors.brand} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{t('print.map_find_place', { q })}</Text>
          <Icon name="back" size={14} color={colors.textTertiary} />
        </TouchableOpacity>
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPick, onQuery, q, t]);

  return (
    <View style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.background, ...shadows.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, borderRadius: 25, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.brand, paddingHorizontal: 6 }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.back')} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="forward" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TextInput value={query} onChangeText={onQuery} autoFocus placeholder={t('print.map_search_ph')} placeholderTextColor={colors.textTertiary}
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }} returnKeyType="search" onSubmitEditing={submit}
            autoCorrect={false} autoComplete="off" textContentType="none" spellCheck={false} />
          {query ? (
            <TouchableOpacity onPress={() => onQuery('')} hitSlop={8} accessibilityRole="button" style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={17} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList data={lines} keyExtractor={lineKey} renderItem={renderLine}
        initialNumToRender={12} maxToRenderPerBatch={10} windowSize={7}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} />
    </View>
  );
}
