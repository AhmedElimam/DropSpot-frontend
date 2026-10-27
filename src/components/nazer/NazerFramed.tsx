import { memo, type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { BrandMark } from '@/components/ui/BrandMark';
import { NazerFace } from './NazerFace';
import type { NazerMood } from '@/nazer/manifest';

// مدام روز's picture is a 400-unit square: her medallion (r 176.4) sits at (200, 212), her
// single gold ring on its rim and the Dros Spot crown above it. His frame is the same drawing.
const BOX = 400;
const CX = 200;
const CY = 212;
const R = 176.4;
const GOLD = '#C9A227';
/** The ring before he is opened: iron (the website's grayscale, darkened gold). */
const IRON = '#55585F';

type Style = StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;

/**
 * الناظر in مدام روز's frame (founder 2026-10-23: «add the frame», as on the website): her gold
 * ring on his medallion's rim and her crown — the Dros Spot mark in a navy disc between laurel
 * sprigs — above it. `size` is the whole picture, as her portrait's size is, so he drops into
 * every place she stands (his office band, popups, the tour card).
 *
 * Drawn, not painted: the ring and the crown are vectors and the mark is the app's own
 * BrandMark tinted gold, so the frame adds no picture to the bundle.
 *
 * For his unlock (NazerUnlockStage) the ring is iron underneath and `goldStyle` fades the gold
 * in over it; `crownStyle` sets the crown down. Without them he is simply framed. `over` is laid
 * on his medallion (the locked silhouette).
 */
export const NazerFramed = memo(function NazerFramed({ size, mood = 'neutral', blink = true, goldStyle, crownStyle, over, style }: {
  size: number;
  mood?: NazerMood;
  blink?: boolean;
  goldStyle?: Style;
  crownStyle?: Style;
  over?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const u = size / BOX;
  const face = 2 * R * u;
  return (
    <View style={[{ width: size, height: size }, style]} accessibilityRole="image" accessibilityLabel="الناظر صلاح الدين">
      <View style={{ position: 'absolute', left: (CX - R) * u, top: (CY - R) * u, width: face, height: face }}>
        <NazerFace mood={mood} size={face} blink={blink} />
        {over ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>{over}</View> : null}
      </View>
      {goldStyle ? (
        <>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}><Ring size={size} stroke={IRON} /></View>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, goldStyle]}><Ring size={size} stroke={GOLD} /></Animated.View>
        </>
      ) : (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}><Ring size={size} stroke={GOLD} /></View>
      )}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, crownStyle]}>
        <Crown size={size} />
      </Animated.View>
    </View>
  );
});

function Ring({ size, stroke }: { size: number; stroke: string }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
      <Circle cx={CX} cy={CY} r={R} fill="none" stroke={stroke} strokeWidth={5.4} />
      <Circle cx={CX} cy={CY} r={167.4} fill="none" stroke={stroke} strokeOpacity={0.35} strokeWidth={1.35} />
    </Svg>
  );
}

/** Her crown, copied from her artwork (the website's nazer-crown.svg), with the mark in its disc. */
const Crown = memo(function Crown({ size }: { size: number }) {
  const u = size / BOX;
  return (
    <>
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
        <Path d="M161.5 31.0 A185 185 0 0 0 64.7 85.8" fill="none" stroke="#A8861A" strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M0 0 C4.5 -4.5 11.2 -4.5 15.0 0 C11.2 4.5 4.5 4.5 0 0 Z" transform="translate(152.1 33.3) rotate(-145.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C4.5 -4.5 11.2 -4.5 15.0 0 C11.2 4.5 4.5 4.5 0 0 Z" transform="translate(152.1 33.3) rotate(-223.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C4.0 -4.0 10.1 -4.0 13.4 0 C10.1 4.0 4.0 4.0 0 0 Z" transform="translate(130.7 40.5) rotate(-164.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C3.5 -3.5 8.9 -3.5 11.8 0 C8.9 3.5 3.5 3.5 0 0 Z" transform="translate(110.3 50.2) rotate(-159.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C3.5 -3.5 8.9 -3.5 11.8 0 C8.9 3.5 3.5 3.5 0 0 Z" transform="translate(110.3 50.2) rotate(-237.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C3.1 -3.1 7.6 -3.1 10.2 0 C7.6 3.1 3.1 3.1 0 0 Z" transform="translate(91.3 62.3) rotate(-178.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C2.6 -2.6 6.4 -2.6 8.6 0 C6.4 2.6 2.6 2.6 0 0 Z" transform="translate(73.8 76.7) rotate(-173.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C2.6 -2.6 6.4 -2.6 8.6 0 C6.4 2.6 2.6 2.6 0 0 Z" transform="translate(73.8 76.7) rotate(-251.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Circle cx={59.3} cy={91.9} r={2.6} fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M238.5 31.0 A185 185 0 0 1 335.3 85.8" fill="none" stroke="#A8861A" strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M0 0 C4.5 -4.5 11.2 -4.5 15.0 0 C11.2 4.5 4.5 4.5 0 0 Z" transform="translate(247.9 33.3) rotate(-35.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C4.5 -4.5 11.2 -4.5 15.0 0 C11.2 4.5 4.5 4.5 0 0 Z" transform="translate(247.9 33.3) rotate(43.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C4.0 -4.0 10.1 -4.0 13.4 0 C10.1 4.0 4.0 4.0 0 0 Z" transform="translate(269.3 40.5) rotate(-16.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C3.5 -3.5 8.9 -3.5 11.8 0 C8.9 3.5 3.5 3.5 0 0 Z" transform="translate(289.7 50.2) rotate(-21.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C3.5 -3.5 8.9 -3.5 11.8 0 C8.9 3.5 3.5 3.5 0 0 Z" transform="translate(289.7 50.2) rotate(57.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C3.1 -3.1 7.6 -3.1 10.2 0 C7.6 3.1 3.1 3.1 0 0 Z" transform="translate(308.7 62.3) rotate(-2.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C2.6 -2.6 6.4 -2.6 8.6 0 C6.4 2.6 2.6 2.6 0 0 Z" transform="translate(326.2 76.7) rotate(-7.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Path d="M0 0 C2.6 -2.6 6.4 -2.6 8.6 0 C6.4 2.6 2.6 2.6 0 0 Z" transform="translate(326.2 76.7) rotate(71.0)" fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Circle cx={340.7} cy={91.9} r={2.6} fill="#C9A227" stroke="#A8861A" strokeWidth={0.7} />
        <Circle cx={200} cy={35} r={29} fill="#0F1433" stroke="#C9A227" strokeWidth={3.5} />
        <Circle cx={200} cy={35} r={24.2} fill="none" stroke="#C9A227" strokeOpacity={0.45} strokeWidth={1} />
      </Svg>
      <View style={{ position: 'absolute', left: 181 * u, top: 18.3 * u, width: 38 * u, height: 33.3 * u, alignItems: 'center', justifyContent: 'center' }}>
        <BrandMark size={33.3 * u} tint={GOLD} />
      </View>
    </>
  );
});
