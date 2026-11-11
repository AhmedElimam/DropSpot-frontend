import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { sampleSource, type ShopSample } from '@/api/print';

const photoKey = (p: ShopSample) => String(p.id);

/**
 * A shop's work full screen: swipe between photos, what each one is under it, «٣ / ٨» on
 * top, tap or ✕ to close. `start` is the photo it opens on (null = closed).
 */
export function SampleViewer({ items, start, onClose }: { items: ShopSample[]; start: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [at, setAt] = useState(start ?? 0);
  useEffect(() => { if (start != null) setAt(start); }, [start]);
  const current = items[at];
  const renderPhoto = useCallback(({ item: p }: { item: ShopSample }) => (
    <Pressable onPress={onClose} style={{ width, justifyContent: 'center' }}>
      <Image source={sampleSource(p.url)} style={{ width, height: '74%' }} contentFit="contain" transition={120} />
    </Pressable>
  ), [onClose, width]);
  const pageLayout = useCallback((_: unknown, index: number) => ({ length: width, offset: width * index, index }), [width]);

  return (
    <Modal visible={start != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}>
        {/* One page a photo, windowed: only the photo in view and its neighbours are built. */}
        <FlatList key={start ?? -1} horizontal pagingEnabled data={items} keyExtractor={photoKey} renderItem={renderPhoto}
          initialScrollIndex={items.length ? Math.min(start ?? 0, items.length - 1) : undefined} getItemLayout={pageLayout}
          initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setAt(Math.min(items.length - 1, Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width)))} />

        {/* what this one is */}
        {current && (current.kind_label || current.caption) ? (
          <View pointerEvents="none" style={{ position: 'absolute', start: spacing.lg, end: spacing.lg, bottom: Platform.OS === 'ios' ? 54 : 28, alignItems: 'center', gap: 6 }}>
            {current.kind_label ? (
              <View style={{ paddingHorizontal: 12, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{current.kind_label}</Text>
              </View>
            ) : null}
            {current.caption ? <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 22, color: '#fff', textAlign: 'center' }} numberOfLines={3}>{current.caption}</Text> : null}
          </View>
        ) : null}

        {items.length > 1 ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: Platform.OS === 'ios' ? 62 : 30, start: 16, paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('print.photo_of', { i: formatNumber(at + 1), n: formatNumber(items.length) })}</Text>
          </View>
        ) : null}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}
          style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 24, end: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={22} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
