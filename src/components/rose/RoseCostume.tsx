import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Rect, Path, Circle, Ellipse, Line } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { REVISION_INK } from '@/theme/revision';
import { useRevisionActive } from '@/hooks/useRevisionTheme';
import { Surface } from '@/ui/surfaces';

/**
 * مدام روز's revision-season costume (founder 2026-10-16: «Madam Rose to change her look to
 * indicate revision mode — be creative»). No new artwork — there is no artist — so her look
 * is PROPS drawn as vectors over her portrait, in its own 400-unit square, made to read as one
 * deliberate outfit for exam season rather than stickers:
 *
 *   glasses     her reading glasses pushed up into her hair — gold frames, a casual tilt —
 *               the look of someone between two tasks (on the head layer, so they tilt with her)
 *   lanyard     an amber lanyard round her neck, a stopwatch hanging at her right: the invigilator.
 *               Its hand jumps a quarter turn every few seconds while she is alive (one 400 ms
 *               UI-thread transform, then stillness — no per-frame work, no heat)
 *   papers      a stack of exam papers, amber-clipped, at the foot of her frame
 *   sash        an amber «موسم المراجعة» ribbon across the bottom rim of her medallion
 *
 * `detail` picks how much of it a small portrait can carry: a 30-pt chip gets the glasses and
 * the ribbon alone; her desk (148 pt) gets everything. Nothing here renders while the season
 * is off — RoseCostume returns null — so her usual portrait is untouched.
 *
 * The 400-square: the face is drawn inside FRAME (inner units; see RoseLive); the body props
 * are in outer units like RoseProps. Her medallion is the circle r≈171 around (200, 211).
 */
const FRAME = 'translate(200 212) scale(0.9) translate(-200 -200)';
const GOLD = '#C9A227';
const GOLD_LIGHT = '#F3E3A0';
const NAVY = '#1A2147';
const PAGE = '#FBF8EE';
const RULE = '#B9B2A0';
const AMBER = REVISION_INK.amber;
const AMBER_DEEP = REVISION_INK.amberDeep;
const WATCH = { x: 292, y: 322, r: 19 };

export type CostumeDetail = 'light' | 'full';

/** Glasses pushed up into her hair — inner units, so pass it inside the head's layer. */
export const Glasses = memo(function Glasses() {
  return (
    <G transform="rotate(-7 200 150)">
      {/* temples, folded back into the hair */}
      <Path d="M165 151 L150 146 M235 151 L250 146" stroke={GOLD} strokeWidth={2.4} strokeLinecap="round" />
      {/* lenses */}
      <Ellipse cx={181} cy={151} rx={14} ry={9.6} fill="rgba(228,231,246,0.38)" stroke={GOLD} strokeWidth={2.8} />
      <Ellipse cx={219} cy={151} rx={14} ry={9.6} fill="rgba(228,231,246,0.38)" stroke={GOLD} strokeWidth={2.8} />
      <Path d="M172 147 q4 -4 9 -3" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d="M210 147 q4 -4 9 -3" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      {/* bridge */}
      <Path d="M195 150 Q200 146 205 150" stroke={GOLD} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    </G>
  );
});

/** The lanyard and the stopwatch's still parts (body, crown, ticks) — outer units. */
function Lanyard() {
  return (
    <G>
      {/* the cord, from both shoulders down to the watch */}
      <Path d="M174 266 C 196 304, 250 312, 290 302" stroke={AMBER} strokeWidth={4.5} strokeLinecap="round" fill="none" />
      <Path d="M226 266 C 248 284, 274 290, 291 300" stroke={AMBER_DEEP} strokeWidth={4.5} strokeLinecap="round" fill="none" />
      {/* the clasp */}
      <Rect x={286} y={296} width={12} height={9} rx={2.5} fill={GOLD} />
      {/* crown and side button */}
      <Rect x={288} y={300} width={8} height={7} rx={2} fill={GOLD} />
      <Rect x={304} y={306} width={7} height={5} rx={2} fill={GOLD} transform="rotate(35 307 308)" />
      {/* the case and the face */}
      <Circle cx={WATCH.x} cy={WATCH.y} r={WATCH.r} fill={NAVY} />
      <Circle cx={WATCH.x} cy={WATCH.y} r={WATCH.r - 3.5} fill={PAGE} />
      {[0, 90, 180, 270].map((a) => (
        <Line key={a} x1={WATCH.x} y1={WATCH.y - WATCH.r + 5} x2={WATCH.x} y2={WATCH.y - WATCH.r + 8.5} stroke={NAVY} strokeWidth={2} strokeLinecap="round" transform={`rotate(${a} ${WATCH.x} ${WATCH.y})`} />
      ))}
      <Circle cx={WATCH.x} cy={WATCH.y} r={2} fill={AMBER} />
    </G>
  );
}

/** The stopwatch's hand: a quarter turn every few seconds while she is alive. */
function WatchHand({ k, alive }: { k: number; alive: boolean }) {
  const angle = useSharedValue(0);
  useEffect(() => {
    if (!alive) { cancelAnimation(angle); angle.value = 0; return; }
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      angle.value = withTiming(angle.value + 90, { duration: 420, easing: Easing.out(Easing.back(1.6)) });
      t = setTimeout(tick, 5200 + Math.random() * 2400);
    };
    t = setTimeout(tick, 1200);
    return () => clearTimeout(t);
  }, [alive, angle]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  const r = WATCH.r;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (WATCH.x - r) * k, top: (WATCH.y - r) * k, width: 2 * r * k, height: 2 * r * k }, st]}>
      <Svg width={2 * r * k} height={2 * r * k} viewBox={`0 0 ${2 * r} ${2 * r}`}>
        <Line x1={r} y1={r} x2={r} y2={6} stroke={AMBER_DEEP} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/** A stack of exam papers at the foot of her frame, amber-clipped — outer units. */
function Papers() {
  const sheet = (dx: number, dy: number, rot: number, fill: string) => (
    <G transform={`rotate(${rot} 90 352) translate(${dx} ${dy})`}>
      <Rect x={54} y={322} width={72} height={60} rx={3} fill={fill} stroke="#E5DDC8" strokeWidth={1.2} />
    </G>
  );
  return (
    <G>
      {sheet(4, 6, -14, '#F1EBD9')}
      {sheet(2, 3, -10, '#F6F1E2')}
      <G transform="rotate(-7 90 352)">
        <Rect x={54} y={322} width={72} height={60} rx={3} fill={PAGE} stroke="#E5DDC8" strokeWidth={1.2} />
        <G stroke={RULE} strokeWidth={1.5} strokeLinecap="round">
          <Path d="M64 340 H112 M64 349 H106 M64 358 H112 M64 367 H98" />
        </G>
        {/* the title line and the mark box */}
        <Path d="M70 331 H110" stroke={NAVY} strokeWidth={2.2} strokeLinecap="round" />
        <Rect x={104} y={360} width={16} height={12} rx={2} fill="none" stroke={AMBER} strokeWidth={1.6} />
        {/* the amber clip */}
        <Rect x={58} y={316} width={14} height={20} rx={4} fill={AMBER} />
        <Rect x={61} y={319} width={8} height={14} rx={3} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.4} />
      </G>
    </G>
  );
}

/** The amber «موسم المراجعة» sash across the bottom rim of her medallion. */
export function RoseSash({ size, text = 'موسم المراجعة' }: { size: number; text?: string }) {
  const k = size / 400;
  const withText = size >= 56;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={size} height={size} viewBox="0 0 400 400" style={StyleSheet.absoluteFill}>
        {/* folded tails, then the band over them */}
        <Path d="M96 372 L82 396 L120 396 L112 372 Z" fill={AMBER_DEEP} />
        <Path d="M304 372 L318 396 L280 396 L288 372 Z" fill={AMBER_DEEP} />
        <Rect x={104} y={366} width={192} height={30} rx={5} fill={AMBER} />
        <Rect x={104} y={366} width={192} height={5} rx={2.5} fill={GOLD_LIGHT} opacity={0.55} />
        <Rect x={104} y={391} width={192} height={5} rx={2.5} fill={AMBER_DEEP} opacity={0.6} />
      </Svg>
      {withText ? (
        <View style={{ position: 'absolute', left: 104 * k, top: 366 * k, width: 192 * k, height: 30 * k, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: Math.max(8, 16 * k), lineHeight: Math.max(10, 20 * k), color: '#FFFFFF', includeFontPadding: false }} numberOfLines={1}>{text}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Everything on her body (not the head): the lanyard, the watch, the papers — drawn OVER the
 * portrait and UNDER whatever she holds (RoseProps), so a ledger in her hands sits in front
 * of the watch as it would.
 */
export function RoseCostumeBody({ size, alive, detail }: { size: number; alive: boolean; detail: CostumeDetail }) {
  const k = size / 400;
  if (detail !== 'full') return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={size} height={size} viewBox="0 0 400 400" style={StyleSheet.absoluteFill}>
        <Papers />
        <Lanyard />
      </Svg>
      <WatchHand k={k} alive={alive} />
    </View>
  );
}

/** The glasses alone, as a still layer over a still portrait (RosePortrait, RoseSleeping). */
export function RoseGlassesLayer({ size, tilt = 0 }: { size: number; tilt?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, tilt ? { transform: [{ rotate: `${tilt}deg` }], transformOrigin: [size / 2, size * 0.98, 0] } : null]}>
      <Svg width={size} height={size} viewBox="0 0 400 400"><G transform={FRAME}><Glasses /></G></Svg>
    </View>
  );
}

/**
 * The whole costume for a STILL portrait (the home shortcut, a hub row, her sleeping picture):
 * null while the season is off. The live figure composes the pieces itself (RoseLive), so the
 * glasses can ride on her head layer.
 */
export function RoseCostume({ size, detail = size >= 100 ? 'full' : 'light', tilt = 0, sash = true }: { size: number; detail?: CostumeDetail; tilt?: number; sash?: boolean }) {
  const on = useRevisionActive();
  if (!on || size < 24) return null;
  return (
    <Surface id="teacher.rose.costume">
      <RoseCostumeBody size={size} alive={false} detail={detail} />
      <RoseGlassesLayer size={size} tilt={tilt} />
      {sash ? <RoseSash size={size} /> : null}
    </Surface>
  );
}

/** The amber ribbon tails under her stamp while the season is on. */
export function StampRibbon({ size }: { size: number }) {
  const on = useRevisionActive();
  if (!on) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', right: -size * 0.06, bottom: -size * 0.1, width: size * 0.42, height: size * 0.34 }}>
      <Svg width="100%" height="100%" viewBox="0 0 42 34">
        <Path d="M14 2 L26 2 L30 30 L22 24 L14 30 Z" fill={AMBER} transform="rotate(-18 22 16)" />
        <Path d="M2 6 L14 6 L22 30 L14 24 L4 30 Z" fill={AMBER_DEEP} transform="rotate(14 12 18)" />
        <Path d="M14 2 L26 2 L30 30 L22 24 L14 30 Z" fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1} transform="rotate(-18 22 16)" />
      </Svg>
    </View>
  );
}
