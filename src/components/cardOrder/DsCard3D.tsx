import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/**
 * The printed Dros Spot card, both faces — the same pictures as the landing page's card pair
 * (backend public/images/card-*-520.webp). They are fetched from drosspot.app and cached, not
 * bundled: the Android asset budget is full (as with الناظر's unlock sound).
 */
export const CARD_FRONT = { uri: 'https://drosspot.app/images/card-front-520.webp' };
export const CARD_BACK = { uri: 'https://drosspot.app/images/card-back-520.webp' };
/** The pictures are 1027 × 1590 — a portrait CR80. */
export const CARD_RATIO = 1590 / 1027;

/** Fetch both faces ahead of the show, so the silhouette and the flip never wait on the network. */
export function prefetchCardFaces() {
  Image.prefetch([CARD_FRONT.uri, CARD_BACK.uri], 'memory-disk').catch(() => {});
}

/**
 * The card turning in 3-D. `turn` is in degrees (0 = the front, 180 = the back, 360 = the front
 * again); `tiltX` leans it toward or away; `sheen` (0→1) sweeps a band of light across whichever
 * face is up; `dark` (1 → 0) is its locked silhouette. Every value is driven by the caller, so
 * nothing here moves on its own.
 */
export function DsCard3D({ width, turn, tiltX, sheen, dark }: {
  width: number;
  turn: SharedValue<number>;
  tiltX: SharedValue<number>;
  sheen: SharedValue<number>;
  dark: SharedValue<number>;
}) {
  const height = width * CARD_RATIO;
  const radius = width * 0.06;
  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${tiltX.value}deg` }, { rotateY: `${turn.value}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${tiltX.value}deg` }, { rotateY: `${turn.value + 180}deg` }],
  }));
  const darkStyle = useAnimatedStyle(() => ({ opacity: dark.value }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: sheen.value <= 0 || sheen.value >= 1 ? 0 : 1,
    transform: [{ translateX: interpolate(sheen.value, [0, 1], [-width * 1.2, width * 1.2]) }, { rotate: '18deg' }],
  }));

  const faceBox = { width, height, borderRadius: radius, overflow: 'hidden' as const, backfaceVisibility: 'hidden' as const };
  return (
    <View style={{ width, height }}>
      <Animated.View style={[StyleSheet.absoluteFill, faceBox, back]}>
        <Image source={CARD_BACK} style={{ width, height }} contentFit="cover" cachePolicy="memory-disk" accessibilityLabel="كارت دروس سبوت — وجه البيانات" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, faceBox, front]}>
        <Image source={CARD_FRONT} style={{ width, height }} contentFit="cover" cachePolicy="memory-disk" accessibilityLabel="كارت دروس سبوت — وجه رمز الحضور" />
        {/* Locked: the card as an ink silhouette. A plain panel in the face's own rounded box, so it
            is there from the first frame — a tinted copy of the picture took a moment to load at
            each new size and let the card show through before the reveal (founder 2026-11-07). */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#070A1C', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: radius }, darkStyle]} />
      </Animated.View>
      {/* The light sweeping across the card, clipped to its corners. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', backfaceVisibility: 'hidden' }, front]}>
        <Animated.View style={[{ position: 'absolute', top: -height * 0.2, bottom: -height * 0.2, left: width * 0.35, width: width * 0.3 }, sheenStyle]}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
