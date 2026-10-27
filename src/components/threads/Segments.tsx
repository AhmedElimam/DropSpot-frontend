import { useEffect, useState } from 'react';
import { FlatList, I18nManager, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows, spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { arDigits } from './format';

export interface SegmentItem<K extends string> { key: K; label: string; icon: IconName; badge: number }

const PAD = 4;

/**
 * حكاوي / الدردشة: one track, a filled pill that slides to the chosen side (a spring on the
 * UI thread, only when the choice changes). Sits on the hero's seam, like the chat inbox's
 * chips. Each side carries its own unread count.
 *
 * `scroll` (founder 2026-10-28: «tabs will be scrollable»): the hub's chips in one row that
 * scrolls sideways, each as wide as its word, the way a social feed's filter chips read.
 * A short horizontal list, so a FlatList with its windowing props, never a ScrollView of
 * mapped chips (performance guardrails).
 */
export function Segments<K extends string>({ items, value, onChange, scroll = false }: { items: SegmentItem<K>[]; value: K; onChange: (k: K) => void; scroll?: boolean }) {
  if (scroll) return <ScrollChips items={items} value={value} onChange={onChange} />;
  return <Track items={items} value={value} onChange={onChange} />;
}

function Track<K extends string>({ items, value, onChange }: { items: SegmentItem<K>[]; value: K; onChange: (k: K) => void }) {
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
      style={{ flexDirection: 'row', padding: PAD, borderRadius: radius.lg + PAD, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadows.md }}
    >
      {slot > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: PAD, bottom: PAD, start: PAD, width: slot, borderRadius: radius.lg, backgroundColor: colors.brand }, pill]} />
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
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 42, borderRadius: radius.lg, backgroundColor: slot > 0 || !on ? 'transparent' : colors.brand }}
          >
            <Icon name={it.icon} size={17} color={on ? colors.onPrimary : colors.textSecondary} outline={!on} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: on ? colors.onPrimary : colors.textSecondary }}>{it.label}</Text>
            <Count n={it.badge} on={on} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ScrollChips<K extends string>({ items, value, onChange }: { items: SegmentItem<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(it) => it.key}
      renderItem={({ item: it }) => {
        const on = it.key === value;
        return (
          <TouchableOpacity
            onPress={() => { if (!on) onChange(it.key); }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border, ...shadows.sm }}
          >
            <Icon name={it.icon} size={16} color={on ? colors.onPrimary : colors.textSecondary} outline={!on} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: on ? colors.onPrimary : colors.textSecondary }}>{it.label}</Text>
            <Count n={it.badge} on={on} />
          </TouchableOpacity>
        );
      }}
      ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 2 }}
      windowSize={3}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
    />
  );
}

function Count({ n, on }: { n: number; on: boolean }) {
  if (n <= 0) return null;
  return (
    <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: on ? 'rgba(255,255,255,0.25)' : colors.danger, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onPrimary }}>{n > 99 ? '+٩٩' : arDigits(n)}</Text>
    </View>
  );
}
