import { useEffect, useState } from 'react';
import { I18nManager, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows, spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';

export interface SegmentItem<K extends string> { key: K; label: string; icon: IconName; badge: number }

const PAD = 4;
const H = 44;

/**
 * مجتمعنا / الدردشة / حكاوي: one rounded track, a brand pill that slides to the chosen side (a
 * spring on the UI thread, only when the choice changes). Each side carries its own count.
 *
 * The count (founder 2026-10-28: «some love on the segments and how the numbers are
 * highlighted»): a small badge in the phone's own digits — truly centred, as on مدام روز and the
 * bell — red with a ring on a side you are not on, white with brand digits on the one you are.
 */
export function Segments<K extends string>({ items, value, onChange }: { items: SegmentItem<K>[]; value: K; onChange: (k: K) => void }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, items.findIndex((i) => i.key === value));
  const slot = width > 0 ? (width - PAD * 2) / items.length : 0;
  const x = useSharedValue(0);
  // Forced RTL: the first item sits on the right, so moving to the next one is moving left.
  const dir = I18nManager.isRTL ? -1 : 1;
  useEffect(() => { x.value = withSpring(index * slot * dir, { damping: 20, stiffness: 220 }); }, [index, slot, dir]); // eslint-disable-line react-hooks/exhaustive-deps
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', padding: PAD, borderRadius: (H + PAD * 2) / 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, ...shadows.md }}
    >
      {slot > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: PAD, bottom: PAD, start: PAD, width: slot, borderRadius: H / 2, ...shadows.sm }, pill]}>
          <LinearGradient colors={[colors.brand, colors.brandDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: H / 2 }} />
        </Animated.View>
      ) : null}
      {items.map((it) => {
        const on = it.key === value;
        return (
          <TouchableOpacity
            key={it.key}
            onPress={() => { if (!on) onChange(it.key); }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.badge > 0 ? `${it.label} (${it.badge})` : it.label}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: H, paddingHorizontal: spacing.xs, borderRadius: H / 2, backgroundColor: slot > 0 || !on ? 'transparent' : colors.brand }}
          >
            <Icon name={it.icon} size={16} color={on ? colors.onPrimary : colors.textSecondary} outline={!on} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontFamily: fonts.bold, fontSize: 14, color: on ? colors.onPrimary : colors.textSecondary, flexShrink: 1 }}>{it.label}</Text>
            <Count n={it.badge} on={on} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** The side's count: the phone's digits in a true circle (a pill past nine), never Cairo's tall line box. */
function Count({ n, on }: { n: number; on: boolean }) {
  if (n <= 0) return null;
  const over = n > 99;
  const single = !over && n < 10;
  const size = 19;
  const inner = size - 3;
  const text = { fontSize: 11, fontWeight: '700', lineHeight: inner, height: inner, color: on ? colors.brand : '#FFFFFF', textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false } as const;
  return (
    <View style={{ minWidth: size, width: single ? size : undefined, height: size, borderRadius: size / 2, paddingHorizontal: single ? 0 : 5, flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'center',
      backgroundColor: on ? '#FFFFFF' : colors.danger, borderWidth: 1.5, borderColor: on ? 'rgba(255,255,255,0.6)' : colors.surface }}>
      <Text style={text}>{formatNumber(over ? 99 : n)}</Text>
      {over ? <Text style={text}>+</Text> : null}
    </View>
  );
}
