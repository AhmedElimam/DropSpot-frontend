import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, useWindowDimensions } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { sampleSource, type ShopSample } from '@/api/print';

const KIND_ICON: Record<string, IconName> = { booklet: 'book', exam: 'document', color: 'brush', binding: 'list', cover: 'image', other: 'images' };
const GAP = 6;
/** How many tiles the mosaic shows before «+N». */
const SHOWN = 6;

/**
 * «من شغلهم» — the shop's work in its own place on the page (founder 2026-10-14: «we need a
 * better place for work samples»), the way a portfolio opens: chips by kind (ملازم،
 * امتحانات، ألوان…) when there is more than one, then a mosaic — one big piece and two beside
 * it, then a row of three — the last tile «+N». Every tile says what it is; a tap opens the
 * full-screen viewer on that photo, inside the kind chosen.
 */
export function ShopWorkGallery({ items, onOpen }: { items: ShopSample[]; onOpen: (list: ShopSample[], i: number) => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<string | null>(null);
  const kinds = useMemo(() => {
    const seen = new Map<string, { label: string; n: number }>();
    for (const p of items) if (p.kind && p.kind_label) seen.set(p.kind, { label: p.kind_label, n: (seen.get(p.kind)?.n ?? 0) + 1 });
    return [...seen.entries()];
  }, [items]);
  const list = kind ? items.filter((p) => p.kind === kind) : items;
  if (!items.length) return null;

  // the card's inner width: page gutter + card padding on both sides
  const W = width - spacing.lg * 2 - spacing.md * 2;
  const third = (W - GAP * 2) / 3;
  const big = third * 2 + GAP;
  const shown = list.slice(0, SHOWN);
  const more = list.length - shown.length;

  const Tile = ({ p, i, w, h }: { p: ShopSample; i: number; w: number; h: number }) => {
    const last = i === shown.length - 1 && more > 0;
    return (
      <Pressable onPress={() => onOpen(list, i)} accessibilityRole="imagebutton" accessibilityLabel={p.caption ?? p.kind_label ?? undefined}
        style={{ width: w, height: h, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
        <Image source={sampleSource(p.url)} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} recyclingKey={String(p.id)} />
        {!last && (p.kind_label || p.caption) && h >= 100 ? (
          <>
            <LinearGradient pointerEvents="none" colors={['rgba(10,14,39,0)', 'rgba(10,14,39,0.66)']} style={{ position: 'absolute', start: 0, end: 0, bottom: 0, height: 54 }} />
            <Text style={{ position: 'absolute', start: 8, end: 8, bottom: 7, fontFamily: fonts.bold, fontSize: i === 0 ? 12.5 : 11, color: '#fff' }} numberOfLines={1}>
              {p.caption ?? p.kind_label}
            </Text>
          </>
        ) : null}
        {last ? (
          <View style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0, backgroundColor: 'rgba(10,14,39,0.62)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>+{formatNumber(more + 1)}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{t('print.work_more')}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: 4 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="images" size={16} color={colors.accentText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }}>{t('print.work_title')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }}>{t('print.work_sub', { n: formatNumber(items.length) })}</Text>
        </View>
        <TouchableOpacity onPress={() => onOpen(list, 0)} accessibilityRole="button" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('print.work_view')}</Text>
          <Icon name="back" size={13} color={colors.brand} />
        </TouchableOpacity>
      </View>

      {kinds.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: spacing.sm, paddingHorizontal: 2 }}>
          {[[null, { label: t('print.work_all'), n: items.length }] as const, ...kinds].map(([k, v]) => {
            const on = kind === k;
            return (
              <TouchableOpacity key={k ?? 'all'} onPress={() => setKind(k)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: on ? colors.brand : colors.surfaceSunken }}>
                {k ? <Icon name={KIND_ICON[k] ?? 'images'} size={13} color={on ? colors.onPrimary : colors.textSecondary} /> : null}
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.onPrimary : colors.textSecondary }}>{v.label}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: on ? colors.onPrimary : colors.textTertiary, opacity: 0.85 }}>({formatNumber(v.n)})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {/* the mosaic: one big + two stacked, then three across */}
      {shown.length === 1 ? (
        <Tile p={shown[0]} i={0} w={W} h={W * 0.62} />
      ) : shown.length === 2 ? (
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {shown.map((p, i) => <Tile key={p.id} p={p} i={i} w={(W - GAP) / 2} h={(W - GAP) / 2 * 1.2} />)}
        </View>
      ) : (
        <View style={{ gap: GAP }}>
          <View style={{ flexDirection: 'row', gap: GAP }}>
            <Tile p={shown[0]} i={0} w={big} h={big * 0.86} />
            <View style={{ gap: GAP }}>
              <Tile p={shown[1]} i={1} w={third} h={(big * 0.86 - GAP) / 2} />
              <Tile p={shown[2]} i={2} w={third} h={(big * 0.86 - GAP) / 2} />
            </View>
          </View>
          {shown.length > 3 ? (
            <View style={{ flexDirection: 'row', gap: GAP }}>
              {shown.slice(3).map((p, j) => <Tile key={p.id} p={p} i={j + 3} w={third} h={third} />)}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
