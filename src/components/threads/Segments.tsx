import { useEffect, useState } from 'react';
import { I18nManager, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { formatNumber } from '@/utils/format';

/** `logo`: the side's glyph is the brand mark instead of an icon (مجتمعنا — the DS button's own). */
export interface SegmentItem<K extends string> { key: K; label: string; icon: IconName; badge: number; logo?: boolean }

const PAD = 4;
/** A folded side: a round icon button. */
const C = 44;
const GAP = 8;
/** The glyph's box and the space between it and the name, inside the open pill. */
const GLYPH = 20;
const LABEL_GAP = 7;
const SPRING = { damping: 19, stiffness: 210, mass: 0.9 } as const;

/**
 * مجتمعنا / الدردشة / حكاوي as expanding icons (founder 2026-10-29: «icons that expand with a
 * nice toggle animation, the logo on the right and beside it the active tab's name highlighted;
 * switching to messages or threads does that too»). The open side is a brand pill — its glyph on
 * the right, its name beside it; the others fold to round icons with their counts. Switching
 * opens the new side while the old one folds, in one spring.
 *
 * Every moving part is a transform or an opacity (docs/PERFORMANCE.md): the open pill has one
 * fixed width and slides; each glyph and name is placed by translateX from ONE animated index,
 * so the widths "grow" without a layout pass per frame. The hit areas jump straight to the new
 * layout — they are invisible.
 */
export function Segments<K extends string>({ items, value, onChange }: { items: SegmentItem<K>[]; value: K; onChange: (k: K) => void }) {
  const [width, setWidth] = useState(0);
  const [labelW, setLabelW] = useState<Record<string, number>>({});
  const still = useReducedMotion();
  const n = items.length;
  const index = Math.max(0, items.findIndex((i) => i.key === value));
  const inner = Math.max(0, width - PAD * 2);
  // The open pill takes what the folded icons leave.
  const open = Math.max(C, inner - (n - 1) * (C + GAP));
  const t = useSharedValue(index);
  useEffect(() => { t.value = still ? withTiming(index, { duration: 0 }) : withSpring(index, SPRING); }, [index, still]); // eslint-disable-line react-hooks/exhaustive-deps
  // Forced RTL: logical "start" is the right edge, so moving inward is a negative translateX.
  const dir = I18nManager.isRTL ? -1 : 1;

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: dir * t.value * (C + GAP) }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: C + PAD * 2, padding: PAD, borderRadius: (C + PAD * 2) / 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, ...shadows.md }}
    >
      {/* The names, measured once off-screen: the open pill centres glyph + name by their real width. */}
      <View pointerEvents="none" style={{ position: 'absolute', opacity: 0, flexDirection: 'row' }}>
        {items.map((it) => (
          <Text
            key={it.key}
            onLayout={(e) => { const w = Math.ceil(e.nativeEvent.layout.width); setLabelW((m) => (m[it.key] === w ? m : { ...m, [it.key]: w })); }}
            style={labelStyle}
          >
            {it.label}
          </Text>
        ))}
      </View>

      {inner > 0 ? (
        <View style={{ flex: 1 }}>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, start: 0, width: open, borderRadius: C / 2, ...shadows.sm }, pill]}>
            <LinearGradient colors={[colors.brand, colors.brandDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: C / 2 }} />
          </Animated.View>

          {items.map((it, i) => (
            <Side key={it.key} item={it} i={i} t={t} open={open} labelW={Math.max(24, Math.min(labelW[it.key] ?? 56, open - GLYPH - LABEL_GAP - 28))} dir={dir} />
          ))}

          {/* The taps: laid out for the side that is open now, straight away. */}
          {items.map((it, i) => {
            const on = i === index;
            const start = i <= index ? i * (C + GAP) : index * (C + GAP) + open + GAP + (i - index - 1) * (C + GAP);
            return (
              <Pressable
                key={it.key}
                onPress={() => { if (!on) onChange(it.key); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={it.badge > 0 ? `${it.label} (${it.badge})` : it.label}
                style={{ position: 'absolute', top: 0, bottom: 0, start, width: on ? open : C, borderRadius: C / 2 }}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const labelStyle = { fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 20 } as const;

/**
 * One side, placed from the animated index `t`: how open it is (`e`, 1 = the open pill) decides
 * where its glyph sits — centred in its round button when folded, at the start of glyph + name
 * when open — and how much of its name shows.
 */
function Side<K extends string>({ item, i, t, open, labelW, dir }: { item: SegmentItem<K>; i: number; t: SharedValue<number>; open: number; labelW: number; dir: number }) {
  const group = GLYPH + LABEL_GAP + labelW;

  // Where this side starts, and how open it is, for the index as it moves.
  const place = (tv: number) => {
    'worklet';
    let start = 0;
    for (let j = 0; j < i; j++) {
      const ej = Math.max(0, 1 - Math.abs(tv - j));
      start += C + (open - C) * ej + GAP;
    }
    const e = Math.max(0, 1 - Math.abs(tv - i));
    return { start, e, w: C + (open - C) * e };
  };

  const glyph = useAnimatedStyle(() => {
    const { start, e, w } = place(t.value);
    const centre = start + (w / 2) * (1 - e) + ((open - group) / 2 + GLYPH / 2) * e;
    return { transform: [{ translateX: dir * (centre - C / 2) }] };
  });
  const offGlyph = useAnimatedStyle(() => ({ opacity: 1 - place(t.value).e }));
  const onGlyph = useAnimatedStyle(() => ({ opacity: place(t.value).e }));
  const disc = useAnimatedStyle(() => {
    const e = place(t.value).e;
    return { opacity: 1 - e, transform: [{ scale: 1 - 0.25 * e }] };
  });
  const label = useAnimatedStyle(() => {
    const { start, e } = place(t.value);
    const at = start + (open - group) / 2 + GLYPH + LABEL_GAP;
    // The name follows the pill open, a beat behind it, and slides in from the glyph's side.
    const shown = Math.max(0, (e - 0.35) / 0.65);
    return { opacity: shown, transform: [{ translateX: dir * (at - 8 * (1 - shown)) }] };
  });

  const glyphFor = (on: boolean) => (item.logo
    ? <BrandMark size={18} tint={on ? colors.onPrimary : colors.textSecondary} />
    : <Icon name={item.icon} size={19} color={on ? colors.onPrimary : colors.textSecondary} outline={!on} />);

  return (
    <>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, start: 0, width: C, height: C, alignItems: 'center', justifyContent: 'center' }, glyph]}>
        {/* The folded side's own soft disc. */}
        <Animated.View style={[{ position: 'absolute', width: C, height: C, borderRadius: C / 2, backgroundColor: colors.brandTint }, disc]} />
        <Animated.View style={[{ position: 'absolute' }, offGlyph]}>{glyphFor(false)}</Animated.View>
        <Animated.View style={onGlyph}>{glyphFor(true)}</Animated.View>
        <Count n={item.badge} t={t} i={i} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, start: 0, height: C, width: labelW, justifyContent: 'center' }, label]}>
        <Text numberOfLines={1} style={[labelStyle, { color: colors.onPrimary }]}>{item.label}</Text>
      </Animated.View>
    </>
  );
}

/**
 * The side's count on the glyph's corner, in the phone's own digits: red with a ring on a folded
 * side, white with brand digits on the open one (cross-faded with the pill).
 */
function Count({ n, t, i }: { n: number; t: SharedValue<number>; i: number }) {
  const onStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(t.value - i)) }));
  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.max(0, 1 - Math.abs(t.value - i)) }));
  if (n <= 0) return null;
  const over = n > 99;
  const single = !over && n < 10;
  const size = 18;
  const box = (on: boolean) => ({
    position: 'absolute' as const, top: 1, end: 1, minWidth: size, width: single ? size : undefined, height: size, borderRadius: size / 2,
    paddingHorizontal: single ? 0 : 4, flexDirection: 'row' as const, direction: 'ltr' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: on ? '#FFFFFF' : colors.danger, borderWidth: 1.5, borderColor: on ? 'rgba(255,255,255,0.6)' : colors.surface,
  });
  const text = (on: boolean) => ({ fontSize: 10.5, fontWeight: '700' as const, lineHeight: size - 3, height: size - 3, color: on ? colors.brand : '#FFFFFF', textAlign: 'center' as const, includeFontPadding: false });
  const digits = formatNumber(over ? 99 : n) + (over ? '+' : '');
  return (
    <>
      <Animated.View style={[box(false), offStyle]}><Text style={text(false)}>{digits}</Text></Animated.View>
      <Animated.View style={[box(true), onStyle]}><Text style={text(true)}>{digits}</Text></Animated.View>
    </>
  );
}
