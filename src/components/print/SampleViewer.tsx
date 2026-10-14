import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { sampleSource, type ShopSample } from '@/api/print';

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

  return (
    <Modal visible={start != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: (start ?? 0) * width, y: 0 }}
          onMomentumScrollEnd={(e) => setAt(Math.min(items.length - 1, Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width)))}>
          {items.map((p) => (
            <Pressable key={p.id} onPress={onClose} style={{ width, justifyContent: 'center' }}>
              <Image source={sampleSource(p.url)} style={{ width, height: '74%' }} contentFit="contain" transition={120} />
            </Pressable>
          ))}
        </ScrollView>

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
