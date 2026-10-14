import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { sampleSource, type ShopSample } from '@/api/print';

/**
 * The top of a shop's page, the way a delivery app opens a restaurant: its best piece of work
 * as the cover under the status bar, a scrim at the foot for the card that overlaps it. The
 * whole collection lives in its own section under the card (components/print/ShopWorkGallery —
 * founder 2026-10-14: «we need a better place for work samples»); the «N صور» pill and a tap
 * on the cover open it full screen. No photos → the branded hero.
 * `overlap` is how far the identity card rides up over the bottom.
 */
export function ShopPageHero({ items, height, overlap, topInset, onOpen }: { items: ShopSample[]; height: number; overlap: number; topInset: number; onOpen?: (i: number) => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  if (!items.length) {
    return (
      <View style={{ height, overflow: 'hidden' }}>
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', top: topInset, start: 0, end: 0, bottom: overlap, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.onHeroChip, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="print" size={42} color={colors.onHeroSoft} />
          </View>
        </View>
      </View>
    );
  }
  const cover = items[0];

  return (
    <View style={{ height, backgroundColor: colors.surfaceSunken }}>
      <Pressable onPress={() => onOpen?.(0)} accessibilityRole="imagebutton" accessibilityLabel={cover.caption ?? cover.kind_label ?? undefined}>
        <Image source={sampleSource(cover.url)} style={{ width, height, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={150} recyclingKey={String(cover.id)} />
      </Pressable>

      {/* a dark veil top and bottom: the floating buttons stay readable on any photo */}
      <LinearGradient pointerEvents="none" colors={['rgba(10,14,39,0.45)', 'rgba(10,14,39,0)']} style={{ position: 'absolute', top: 0, start: 0, end: 0, height: topInset + 64 }} />
      <LinearGradient pointerEvents="none" colors={['rgba(10,14,39,0)', 'rgba(10,14,39,0.5)']} style={{ position: 'absolute', start: 0, end: 0, bottom: 0, height: overlap + 70 }} />

      {/* how many photos — top end, opposite the back button; opens them */}
      {items.length > 1 ? (
        <Pressable onPress={() => onOpen?.(0)} accessibilityRole="button" hitSlop={6}
          style={{ position: 'absolute', top: topInset + 12, end: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(10,14,39,0.62)' }}>
          <Icon name="images" size={14} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t('print.photos_n', { n: formatNumber(items.length) })}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
