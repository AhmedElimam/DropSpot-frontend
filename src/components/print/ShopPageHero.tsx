import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { sampleSource, type ShopSample } from '@/api/print';

/**
 * The top of a shop's page, the way a delivery app opens a restaurant: its own work
 * edge to edge under the status bar, swipeable, a scrim at the foot for the card that
 * overlaps it, and a tap opens the full-screen viewer. No photos → the branded hero.
 * `overlap` is how far the identity card rides up over the bottom — the dots sit above it.
 */
export function ShopPageHero({ items, height, overlap, topInset }: { items: ShopSample[]; height: number; overlap: number; topInset: number }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const current = items[at];

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

  return (
    <View style={{ height, backgroundColor: colors.surfaceSunken }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setAt(Math.min(items.length - 1, Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width)))}>
        {items.map((p, i) => (
          <Pressable key={p.id} onPress={() => setOpen(i)} accessibilityRole="imagebutton" accessibilityLabel={p.caption ?? p.kind_label ?? undefined}>
            <Image source={sampleSource(p.url)} style={{ width, height, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={150} recyclingKey={String(p.id)} />
          </Pressable>
        ))}
      </ScrollView>

      {/* a dark veil top and bottom: the floating buttons and the dots stay readable on any photo */}
      <LinearGradient pointerEvents="none" colors={['rgba(10,14,39,0.45)', 'rgba(10,14,39,0)']} style={{ position: 'absolute', top: 0, start: 0, end: 0, height: topInset + 64 }} />
      <LinearGradient pointerEvents="none" colors={['rgba(10,14,39,0)', 'rgba(10,14,39,0.62)']} style={{ position: 'absolute', start: 0, end: 0, bottom: 0, height: overlap + 96 }} />

      {/* how many photos — top end, opposite the back button */}
      {items.length > 1 ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: topInset + 12, end: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 11, borderRadius: 15, backgroundColor: 'rgba(10,14,39,0.62)' }}>
          <Icon name="images" size={14} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t('print.photos_n', { n: formatNumber(items.length) })}</Text>
        </View>
      ) : null}

      {/* what this photo is, then the dots — both above the card's overlap */}
      <View pointerEvents="none" style={{ position: 'absolute', start: spacing.lg, end: spacing.lg, bottom: overlap + 12, alignItems: 'center', gap: 8 }}>
        {current && (current.caption || current.kind_label) ? (
          <Text style={{ alignSelf: 'stretch', fontFamily: fonts.bold, fontSize: 13, color: '#fff' }} numberOfLines={1}>
            {[current.kind_label, current.caption].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {items.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {items.map((p, i) => <View key={p.id} style={{ width: i === at ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === at ? '#fff' : 'rgba(255,255,255,0.5)' }} />)}
          </View>
        ) : null}
      </View>

      <Modal visible={open != null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: (open ?? 0) * width, y: 0 }}>
            {items.map((p) => (
              <Pressable key={p.id} onPress={() => setOpen(null)} style={{ width, justifyContent: 'center' }}>
                <Image source={sampleSource(p.url)} style={{ width, height: '78%' }} contentFit="contain" />
                {p.caption || p.kind_label ? (
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: '#fff', textAlign: 'center', padding: spacing.md }}>
                    {[p.kind_label, p.caption].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel={t('common.close')}
            style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 24, end: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={22} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
