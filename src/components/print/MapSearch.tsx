import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ShopLogo } from '@/components/print/ShopLogo';
import { formatNumber } from '@/utils/format';
import { distanceKm, matchPlaces, suggest, wantsPlace, type SearchableShop, type Suggestion } from '@/utils/shopSearch';
import { searchPlaces, type Destination, type FoundPlace } from '@/api/print';

/** What a row in the search page does when tapped. */
export type MapPick =
  | Suggestion
  | { kind: 'place'; place: FoundPlace }
  | { kind: 'near_me' }
  | { kind: 'text'; text: string };

const ICON: Record<string, IconName> = { sort: 'list', filter: 'success', area: 'location', place: 'pin', venue: 'book', near_me: 'gps' };

/**
 * The map's search, Google-Maps style (founder 2026-10-14: «there's no search on map — we want
 * maps search to be smart»): the bar over the map opens this page. While she types it offers,
 * at once and from the phone, what her words mean (a sort, a need), the shops and areas that
 * match, and her own places (centres, schools); for a street, a school or a square it asks
 * the server — after a pause when nothing local explains the words, or at once on «بحث» /
 * «ابحث عن … على الخريطة». Places come nearest-first, with how far they are.
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
  // Ask the map by itself only when nothing here explains the words, after she stops typing.
  const lookup = useMemo(() => wantsPlace(q, shops, caps) && !mine.length, [q, shops, caps, mine.length]);
  useEffect(() => {
    if (!lookup) return;
    const timer = setTimeout(() => setAsked(q), 900);
    return () => clearTimeout(timer);
  }, [q, lookup]);
  const near = me ? { lat: Math.round(me.lat * 10) / 10, lng: Math.round(me.lng * 10) / 10 } : null;
  const places = useQuery({
    queryKey: ['print-places', asked, near?.lat, near?.lng],
    queryFn: () => searchPlaces(asked, near),
    enabled: asked.length >= 2 && asked === q,
    staleTime: 10 * 60_000,
  });
  const found = useMemo(() => {
    const list = places.data ?? [];
    return me ? [...list].sort((a, b) => distanceKm(me, a) - distanceKm(me, b)) : list;
  }, [places.data, me]);
  const askNow = () => { if (q.length >= 2) setAsked(q); };
  const submit = () => {
    // Shops answer it → show them on the map; otherwise look for a place by that name.
    if (local.some((s) => s.kind === 'shop' || s.kind === 'area' || s.kind === 'sort' || s.kind === 'filter')) { Keyboard.dismiss(); onPick({ kind: 'text', text: q }); }
    else askNow();
  };

  const label = (sg: Suggestion) => (sg.kind === 'sort' ? t('print.suggest_sort', { s: t(`print.sort_${sg.key}`) })
    : sg.kind === 'filter' ? t('print.suggest_filter', { c: caps[sg.key] ?? sg.key })
    : sg.kind === 'area' ? sg.text : sg.name);
  const km = (p: { lat: number; lng: number }) => (me ? t('print.km_away', { km: formatNumber(distanceKm(me, p), { maximumFractionDigits: 1 }) }) : null);

  const Row = ({ icon, tint, logo, isShop, title, sub, end, onPress }: { icon?: IconName; tint?: { bg: string; fg: string }; logo?: string | null; isShop?: boolean; title: string; sub?: string | null; end?: string | null; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button"
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
  const Head = ({ text }: { text: string }) => (
    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.md, marginBottom: 2 }}>{text}</Text>
  );

  const shopRows = local.filter((s): s is Extract<Suggestion, { kind: 'shop' }> => s.kind === 'shop');
  const intentRows = local.filter((s) => s.kind === 'sort' || s.kind === 'filter');
  const areaRows = local.filter((s): s is Extract<Suggestion, { kind: 'area' }> => s.kind === 'area');
  const tints = { sort: { bg: colors.brandTint, fg: colors.brand }, filter: { bg: colors.accentLight, fg: colors.accentText } };

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

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {!q ? (
          <>
            {me ? <Row icon={ICON.near_me} tint={{ bg: colors.brandTint, fg: colors.brand }} title={t('print.map_near_me')} sub={t('print.map_near_me_sub')} onPress={() => onPick({ kind: 'near_me' })} /> : null}
            {venues.length ? (
              <>
                <Head text={t('print.map_your_places')} />
                {venues.slice(0, 5).map((v) => (
                  <Row key={v.id} icon={ICON.venue} tint={{ bg: colors.accentLight, fg: colors.accentText }} title={v.name} sub={v.address} end={km(v)}
                    onPress={() => onPick({ kind: 'place', place: { name: v.name, sub: v.address, lat: v.lat, lng: v.lng } })} />
                ))}
              </>
            ) : null}
            <Head text={t('print.suggest_try')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {[t('print.try_1'), t('print.try_2'), t('print.try_3'), t('print.try_place')].map((x) => (
                <TouchableOpacity key={x} onPress={() => onQuery(x)} activeOpacity={0.85} accessibilityRole="button"
                  style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.surfaceSunken, justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{x}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            {intentRows.map((sg, i) => (
              <Row key={`i${i}`} icon={ICON[sg.kind]} tint={tints[sg.kind as 'sort' | 'filter']} title={label(sg)} onPress={() => onPick(sg)} />
            ))}
            {shopRows.length ? <Head text={t('print.map_shops')} /> : null}
            {shopRows.map((sg) => {
              const s = shops.find((x) => x.vendor_id === sg.id) as (SearchableShop & { lat?: number | null; lng?: number | null }) | undefined;
              return <Row key={`s${sg.id}`} isShop logo={sg.logo} title={sg.name} sub={sg.sub} end={s?.lat != null && s?.lng != null ? km({ lat: s.lat, lng: s.lng }) : null} onPress={() => onPick(sg)} />;
            })}
            {areaRows.length ? <Head text={t('print.map_areas')} /> : null}
            {areaRows.map((sg) => <Row key={`a${sg.text}`} icon={ICON.area} title={sg.text} sub={t('print.suggest_area')} onPress={() => onPick(sg)} />)}
            {mine.length ? <Head text={t('print.map_your_places')} /> : null}
            {mine.map((v) => (
              <Row key={`v${v.id}`} icon={ICON.venue} tint={{ bg: colors.accentLight, fg: colors.accentText }} title={v.name} sub={v.address} end={km(v)}
                onPress={() => onPick({ kind: 'place', place: { name: v.name, sub: v.address, lat: v.lat, lng: v.lng } })} />
            ))}

            {/* places on the map */}
            {asked === q && (places.isFetching || found.length || places.isFetched) ? <Head text={t('print.map_places')} /> : null}
            {asked === q && places.isFetching ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} /> : null}
            {asked === q && !places.isFetching ? found.map((p, i) => (
              <Row key={`p${i}`} icon={ICON.place} tint={{ bg: colors.dangerLight, fg: colors.danger }} title={p.name} sub={p.sub} end={km(p)} onPress={() => onPick({ kind: 'place', place: p })} />
            )) : null}
            {asked === q && places.isFetched && !places.isFetching && !found.length ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginVertical: spacing.sm }}>{places.isError ? t('print.map_places_failed') : t('print.map_no_place')}</Text>
            ) : null}
            {asked !== q && q.length >= 2 ? (
              <TouchableOpacity onPress={askNow} activeOpacity={0.85} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="search" size={17} color={colors.brand} />
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{t('print.map_find_place', { q })}</Text>
                <Icon name="back" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
