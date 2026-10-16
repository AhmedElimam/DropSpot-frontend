import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Line, Path, Rect } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { REVISION_INK } from '@/theme/revision';
import { useRevisionActive } from '@/hooks/useRevisionTheme';
import { useRevisions } from '@/hooks/useRevisions';
import { seasonShareLeft } from '@/utils/revisionDesk';
import { Surface } from '@/ui/surfaces';

/**
 * مدام روز's look for «وضع المراجعة» (founder 2026-10-16: «I don't like how Madam Rose is
 * looking» — the first costume read as stickers). THREE directions, each one idea, for the
 * founder to choose from; switching is the one constant below.
 *
 *   A «المراقِبة»       the exam proctor: an amber academic stole laid along her lapels (her
 *                        name badge stays pinned ON it — the badge is drawn back over the stole
 *                        from her own picture), and a small stopwatch pinned as a brooch on the
 *                        left band. Nothing in her hair.
 *   B «موسم التخرّج»    graduation: a navy mortarboard sitting on her hair, its amber tassel
 *                        falling to one side; her frame's laurel turns amber.
 *   C «الإطار يحكي»     nothing on her at all: the gold ring turns amber with a thin cream
 *                        countdown arc round it (the share of the season left before the next
 *                        exam — seasonShareLeft), and a small amber tab «موسم المراجعة» on the
 *                        ring beside the DS medallion.
 *
 * Every prop is a vector in her own 400-unit square (the medallion: ring centre (200, 211.8),
 * radius 176.2, 5 units wide; the DS medallion r 30 at (200, 35); her name badge 54.6 × 22.8 at
 * (225.2, 325.6), tilted −2.6°), drawn to sit ON the illustration — never over her face or her
 * name badge. The live figure (RoseLive) puts the layers inside the view that breathes, nods
 * and sleeps, so every option moves with her; nothing here animates except look A's stopwatch
 * hand (a quarter turn every few seconds, only while she is alive). Off season: nothing renders.
 * She states facts — the tab names the season; nothing here speaks to the teacher.
 */
export type RoseRevisionLook = 'A' | 'B' | 'C';
/** The founder's pick. One line to switch: 'A' «المراقِبة» · 'B' «موسم التخرّج» · 'C' «الإطار يحكي». */
export const ROSE_REVISION_LOOK: RoseRevisionLook = 'A';

const GOLD = '#C9A227';
const GOLD_LIGHT = '#F3E3A0';
const NAVY = '#1A2147';
const PAGE = '#FBF8EE';
const CREAM = '#FFF1D6';
const AMBER = REVISION_INK.amber;
const AMBER_DEEP = REVISION_INK.amberDeep;
const RING = { cx: 200, cy: 211.8, r: 176.2 };
const LAUREL_AMBER = require('../../../assets/images/rose/rose-laurel-amber.webp');

// ── A «المراقِبة» ────────────────────────────────────────────────────────────────────────
// The stole's left band, from the shoulder (under the collar's tip) down her lapel to the
// medallion's rim; the right band is its mirror. Its outer edge carries a light-gold trim.
const STOLE_L: [number, number][] = [[139, 312], [146.5, 307.5], [159, 311], [181, 336], [195.5, 372], [195, 392], [183, 392]];
const STOLE_R = STOLE_L.map(([x, y]) => [400 - x, y] as [number, number]);
const pathOf = (p: [number, number][]) => `M${p.map(([x, y]) => `${x} ${y}`).join(' L')} Z`;
const shade = (p: [number, number][], side: 1 | -1): [number, number][] => [p[2], p[3], p[4], p[5], [p[5][0] + 6 * side, p[5][1]], [p[4][0] + 6 * side, p[4][1]], [p[3][0] + 5 * side, p[3][1] + 2]];
const BADGE = { x: 225.2, y: 325.6, w: 54.6, h: 22.8, rx: 3.8, rot: 'rotate(-2.6 252.5 337)' };
const BROOCH = { x: 166, y: 330, r: 8.5 };

function Stole({ base, uid }: { base: number; uid: string }) {
  const band = (p: [number, number][], side: 1 | -1) => (
    <G>
      <Path d={pathOf(p)} fill={AMBER} />
      <Path d={pathOf(shade(p, side))} fill={AMBER_DEEP} opacity={0.45} />
      <Line x1={p[0][0] - 2 * side} y1={p[0][1] + 1} x2={p[6][0] - 2 * side} y2={p[6][1]} stroke={GOLD_LIGHT} strokeWidth={1.6} opacity={0.9} />
    </G>
  );
  return (
    <>
      <Defs>
        <ClipPath id={`rmed${uid}`}><Circle cx={RING.cx} cy={RING.cy} r={174} /></ClipPath>
        <ClipPath id={`rbadge${uid}`}><Rect x={BADGE.x} y={BADGE.y} width={BADGE.w} height={BADGE.h} rx={BADGE.rx} transform={BADGE.rot} /></ClipPath>
      </Defs>
      <G clipPath={`url(#rmed${uid})`}>
        {band(STOLE_L, -1)}
        {band(STOLE_R, 1)}
      </G>
      {/* Her name badge, pinned on the stole: its shadow, then the badge itself from her own picture. */}
      <Rect x={BADGE.x + 0.4} y={BADGE.y + 1} width={BADGE.w} height={BADGE.h} rx={BADGE.rx} fill="#000000" opacity={0.28} transform={BADGE.rot} />
      <SvgImage href={base} x={0} y={0} width={400} height={400} preserveAspectRatio="xMidYMid meet" clipPath={`url(#rbadge${uid})`} />
    </>
  );
}

/** The stopwatch brooch's still parts — pinned on the left band, crown up. */
function Brooch() {
  const { x, y, r } = BROOCH;
  return (
    <G>
      <Rect x={x - 2.2} y={y - r - 4.6} width={4.4} height={4.2} rx={1.2} fill={GOLD} />
      <Rect x={x - 3.4} y={y - r - 6} width={6.8} height={2.4} rx={1.2} fill={GOLD} />
      <Rect x={x + r - 2} y={y - r - 1} width={3.6} height={2.6} rx={1} fill={GOLD} transform={`rotate(45 ${x} ${y})`} />
      <Circle cx={x} cy={y} r={r} fill={NAVY} />
      <Circle cx={x} cy={y} r={r - 2} fill={PAGE} />
      {[0, 90, 180, 270].map((a) => (
        <Line key={a} x1={x} y1={y - r + 3} x2={x} y2={y - r + 4.8} stroke={NAVY} strokeWidth={1.2} strokeLinecap="round" transform={`rotate(${a} ${x} ${y})`} />
      ))}
      <Circle cx={x} cy={y} r={1.1} fill={AMBER_DEEP} />
    </G>
  );
}

/** The brooch's hand: a quarter turn every few seconds while she is alive (one UI-thread transform). */
function BroochHand({ k, alive }: { k: number; alive: boolean }) {
  const angle = useSharedValue(0);
  useEffect(() => {
    if (!alive) { cancelAnimation(angle); return; }
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      angle.value = withTiming(angle.value + 90, { duration: 420, easing: Easing.out(Easing.back(1.6)) });
      t = setTimeout(tick, 5200 + Math.random() * 2400);
    };
    t = setTimeout(tick, 1200);
    return () => clearTimeout(t);
  }, [alive, angle]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  const r = BROOCH.r;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (BROOCH.x - r) * k, top: (BROOCH.y - r) * k, width: 2 * r * k, height: 2 * r * k }, st]}>
      <Svg width={2 * r * k} height={2 * r * k} viewBox={`0 0 ${2 * r} ${2 * r}`}>
        <Line x1={r} y1={r} x2={r + 3.6} y2={r - 3} stroke={AMBER_DEEP} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

// ── B «موسم التخرّج» ─────────────────────────────────────────────────────────────────────
/** The mortarboard on her hair, the tassel falling at her left (our right). */
export const Mortarboard = memo(function Mortarboard() {
  return (
    <G transform="translate(0 7) rotate(-6 207 92) translate(207 90) scale(0.88) translate(-207 -90)">
      {/* the skull band, sunk into her hair */}
      <Path d="M168 88 L168 99 Q207 112 246 99 L246 88 Z" fill={REVISION_INK.indigoDeeper} />
      <Path d="M168 99 Q207 112 246 99" fill="none" stroke={REVISION_INK.indigo} strokeWidth={1.6} opacity={0.9} />
      {/* the board: its thickness, then its top */}
      <Path d="M136 84 L208 98 L280 82 L280 85.5 L208 101.5 L136 87.5 Z" fill={REVISION_INK.indigoDeeper} />
      <Path d="M136 84 L204 69 L280 82 L208 98 Z" fill={NAVY} />
      <Path d="M136 84 L204 69 L280 82" fill="none" stroke="#3A4590" strokeWidth={1.2} strokeLinejoin="round" />
      {/* the tassel: button, cord to the corner, then down */}
      <Circle cx={207} cy={83} r={3.4} fill={AMBER} />
      <Path d="M207 83 Q246 80 277 83.5" fill="none" stroke={AMBER} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M277 83.5 Q280 98 279 112" fill="none" stroke={AMBER} strokeWidth={2.2} strokeLinecap="round" />
      <Rect x={275.2} y={110} width={7.6} height={5} rx={1.6} fill={GOLD} />
      <Path d="M275 115 L283 115 L285.5 134 Q279 137 272.5 134 Z" fill={AMBER} />
      <Path d="M277.5 117 L276.5 133 M279 117 L279 134.5 M280.5 117 L281.5 133" stroke={AMBER_DEEP} strokeWidth={0.9} opacity={0.8} />
    </G>
  );
});

// ── C «الإطار يحكي» ──────────────────────────────────────────────────────────────────────
const GAP_DEG = 9.4; // the ring runs under the DS medallion for ±9.4° around the top
const at = (deg: number, r = RING.r) => { const a = (deg * Math.PI) / 180; return { x: RING.cx + r * Math.sin(a), y: RING.cy - r * Math.cos(a) }; };
const arc = (a0: number, a1: number, r = RING.r) => {
  const p0 = at(a0, r); const p1 = at(a1, r);
  return `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
};
const TAB = { cx: 287, cy: 92, w: 124, h: 24, rot: 36 };

/** The season's share left, for the ring (a cached query; the minute is not worth a timer here). */
function useShareLeft(enabled: boolean): number | null {
  const q = useRevisions(enabled);
  return useMemo(() => (q.data ? seasonShareLeft(q.data, Date.now()) : null), [q.data]);
}

function FrameRing({ share }: { share: number | null }) {
  const end = share == null ? null : GAP_DEG + share * (360 - 2 * GAP_DEG);
  const head = end == null ? null : at(end);
  return (
    <G>
      <Path d={arc(GAP_DEG, 360 - GAP_DEG)} fill="none" stroke={AMBER} strokeWidth={6.2} />
      <Path d={arc(GAP_DEG, 360 - GAP_DEG)} fill="none" stroke={AMBER_DEEP} strokeWidth={1} opacity={0.6} />
      {end != null && end > GAP_DEG + 0.5 ? <Path d={arc(GAP_DEG, end)} fill="none" stroke={CREAM} strokeWidth={3} strokeLinecap="round" /> : null}
      {head ? <Circle cx={head.x} cy={head.y} r={4.6} fill={CREAM} stroke={AMBER_DEEP} strokeWidth={1.4} /> : null}
    </G>
  );
}

function FrameTab() {
  return (
    <G transform={`rotate(${TAB.rot} ${TAB.cx} ${TAB.cy})`}>
      <Rect x={TAB.cx - TAB.w / 2} y={TAB.cy - TAB.h / 2} width={TAB.w} height={TAB.h} rx={TAB.h / 2} fill={AMBER} stroke={AMBER_DEEP} strokeWidth={1} />
    </G>
  );
}

function FrameTabText({ k }: { k: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: (TAB.cx - TAB.w / 2) * k, top: (TAB.cy - TAB.h / 2) * k, width: TAB.w * k, height: TAB.h * k, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${TAB.rot}deg` }] }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15.5 * k, lineHeight: 20 * k, color: '#FFFFFF', includeFontPadding: false }} numberOfLines={1}>موسم المراجعة</Text>
    </View>
  );
}

// ── the look, whichever it is ──────────────────────────────────────────────────────────────
let uidSeq = 0;

/**
 * Every layer of the chosen look, over a portrait of `size` drawn from `base` (her badge is
 * restored from it in look A). Live figure: `alive` runs the stopwatch hand. Detail drops with
 * size — a 30-pt chip keeps the idea (the stole, the cap, the amber ring), not the small parts.
 */
export const RoseSeasonLook = memo(function RoseSeasonLook({ size, base, alive = false, look = ROSE_REVISION_LOOK }: { size: number; base: number; alive?: boolean; look?: RoseRevisionLook }) {
  const k = size / 400;
  const uid = useMemo(() => String(++uidSeq), []);
  const share = useShareLeft(look === 'C');
  const small = size < 60;
  const withText = size >= 96;
  return (
    // LTR on purpose: the overlays below are placed in the picture's own x (left = the
    // picture's left); under the app's forced RTL a bare `left` would mirror them.
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { direction: 'ltr' }]}>
      {look === 'B' ? <Image source={LAUREL_AMBER} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
      <Svg width={size} height={size} viewBox="0 0 400 400" style={StyleSheet.absoluteFill}>
        {look === 'A' ? <><Stole base={base} uid={uid} />{small ? null : <Brooch />}</> : null}
        {look === 'B' ? <Mortarboard /> : null}
        {look === 'C' ? <><FrameRing share={share} />{withText ? <FrameTab /> : null}</> : null}
      </Svg>
      {look === 'A' && !small ? <BroochHand k={k} alive={alive} /> : null}
      {look === 'C' && withText ? <FrameTabText k={k} /> : null}
    </View>
  );
});

/**
 * The look over a STILL portrait (the home shortcut, a hub row, a dialog head, her sleeping
 * picture): null while the season is off. The live figure mounts RoseSeasonLook itself, inside
 * the view that moves.
 */
export function RoseCostume({ size, base }: { size: number; base: number }) {
  const on = useRevisionActive();
  if (!on || size < 24) return null;
  return <Surface id="teacher.rose.costume"><RoseSeasonLook size={size} base={base} /></Surface>;
}

/**
 * Her stamp's season mark, following the look: A the stole's two amber ends under it, B a
 * small mortarboard on its crest, C a little amber dial with the same countdown arc.
 */
export function StampRibbon({ size, look = ROSE_REVISION_LOOK }: { size: number; look?: RoseRevisionLook }) {
  const on = useRevisionActive();
  const share = useShareLeft(on && look === 'C');
  if (!on) return null;
  if (look === 'B') {
    return (
      <View pointerEvents="none" style={{ position: 'absolute', left: size * 0.26, top: -size * 0.12, width: size * 0.48, height: size * 0.3, transform: [{ rotate: '-8deg' }] }}>
        <Svg width="100%" height="100%" viewBox="130 64 160 76"><Mortarboard /></Svg>
      </View>
    );
  }
  if (look === 'C') {
    const d = size * 0.36;
    const end = share == null ? null : share * 360;
    const c = (deg: number) => { const a = (deg * Math.PI) / 180; return { x: 20 + 15 * Math.sin(a), y: 20 - 15 * Math.cos(a) }; };
    const p1 = end == null ? null : c(Math.min(end, 359.5));
    return (
      <View pointerEvents="none" style={{ position: 'absolute', right: -size * 0.06, bottom: -size * 0.06, width: d, height: d }}>
        <Svg width="100%" height="100%" viewBox="0 0 40 40">
          <Circle cx={20} cy={20} r={18} fill={NAVY} />
          <Circle cx={20} cy={20} r={15} fill="none" stroke={AMBER} strokeWidth={4.5} />
          {p1 && end! > 1 ? <Path d={`M20 5 A15 15 0 ${end! > 180 ? 1 : 0} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`} fill="none" stroke={CREAM} strokeWidth={2.6} strokeLinecap="round" /> : null}
          <Circle cx={20} cy={20} r={2.4} fill={AMBER} />
        </Svg>
      </View>
    );
  }
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
