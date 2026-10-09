import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Rect, Path, Ellipse } from 'react-native-svg';
import { Image } from 'expo-image';
import Animated, { Easing, FadeInDown, FadeOut, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

/**
 * What مدام روز has in her hands, by the tab you are on (founder 2026-10-08: «papers on her
 * notes tab, a booklet for bookkeeping on expenses»):
 *
 *   expenses    her ledger, open — a page turns every few seconds
 *   notes       a sheet she writes on, line by line, right to left, then pulls away for a fresh one
 *   complaints  a small rubber stamp that thumps her red mark onto a slip, then the next slip
 *
 * Drawn in the portrait's own 400-unit square (outer units), over the blazer, so they sit
 * in front of her like something she holds. Every motion is a view transform on the UI thread.
 */
export type RoseActivity = 'cash' | 'expenses' | 'complaints' | 'notes';

const NAVY = '#1A2147';
const PAGE = '#FBF8EE';
const PAGE_DIM = '#F3EDDC';
const RULE = '#B9B2A0';
const GOLD = '#C9A227';
const RED = '#B8323F';
const STAMP_RED = require('../../../assets/images/rose/rose-stamp-red.webp');

export function RoseProps({ activity, size, alive }: { activity: RoseActivity; size: number; alive: boolean }) {
  if (activity === 'cash') return null;
  return (
    <Animated.View key={activity} entering={FadeInDown.duration(380)} exiting={FadeOut.duration(160)} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {activity === 'expenses' ? <Ledger k={size / 400} alive={alive} /> : activity === 'notes' ? <Notes k={size / 400} alive={alive} /> : <StampDesk k={size / 400} alive={alive} />}
    </Animated.View>
  );
}

// ───────────── the ledger ─────────────
// Book: x 120…280, y 298…374, spine at x 200.
function Ledger({ k, alive }: { k: number; alive: boolean }) {
  const flip = useSharedValue(1); // 1 = right page lying right … −1 = turned onto the left
  const shown = useSharedValue(0);
  useEffect(() => {
    if (!alive) { cancelAnimation(flip); flip.value = 1; shown.value = 0; return; }
    let t: ReturnType<typeof setTimeout>;
    const turn = () => {
      shown.value = 1;
      flip.value = 1;
      flip.value = withSequence(withTiming(-1, { duration: 620, easing: Easing.inOut(Easing.cubic) }), withDelay(260, withTiming(-1, { duration: 1 })));
      // When it has landed, hide the turned leaf (the left page under it looks the same).
      // A page every 6–9 s, not every 3–5: short bursts with stillness between (founder 2026-10-09: no heat).
      t = setTimeout(() => { shown.value = withTiming(0, { duration: 160 }); t = setTimeout(turn, 5200 + Math.random() * 3000); }, 900);
    };
    t = setTimeout(turn, 1400);
    return () => clearTimeout(t);
  }, [alive, flip, shown]);
  const leaf = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scaleX: flip.value }] }));
  const lines = (x0: number, x1: number, last: number) => (
    <G stroke={RULE} strokeWidth={1.6} strokeLinecap="round">
      {[312, 322, 332, 342].map((y) => <Path key={y} d={`M${x0} ${y} H${x1}`} />)}
      <Path d={`M${x0} 352 H${last}`} />
    </G>
  );
  return (
    <>
      <Svg width={400 * k} height={400 * k} viewBox="0 0 400 400" style={StyleSheet.absoluteFill}>
        <Rect x={120} y={302} width={160} height={72} rx={6} fill={NAVY} />
        <Rect x={124} y={298} width={74} height={70} rx={3} fill={PAGE_DIM} />
        <Rect x={202} y={298} width={74} height={70} rx={3} fill={PAGE} />
        <Path d="M200 298 V368" stroke={GOLD} strokeWidth={2.5} />
        {lines(134, 188, 170)}
        {lines(212, 266, 250)}
        <Path d="M240 298 V330 l6 -6 l6 6 V298 Z" fill={RED} />
      </Svg>
      {/* The turning leaf: the right page, hinged on the spine. */}
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [200 * k, 336 * k, 0] }, leaf]}>
        <Svg width={400 * k} height={400 * k} viewBox="0 0 400 400">
          <Rect x={202} y={298} width={74} height={70} rx={3} fill={PAGE} stroke="#E5DDC8" strokeWidth={1} />
          {lines(212, 266, 240)}
        </Svg>
      </Animated.View>
    </>
  );
}

// ───────────── the notes sheet ─────────────
// Sheet: 104 × 96 units, centred at (206, 334), tilted −7°. Lines in the sheet's own units.
const SHEET = { x: 154, y: 288, w: 104, h: 96 };
const LINES = [{ y: 30, x0: 14, x1: 88 }, { y: 44, x0: 24, x1: 88 }, { y: 58, x0: 18, x1: 88 }, { y: 72, x0: 44, x1: 88 }];

function Notes({ k, alive }: { k: number; alive: boolean }) {
  const w = useSharedValue(0); // 0…4: how much has been written
  const pull = useSharedValue(0); // 1 = the sheet pulled away below
  useEffect(() => {
    if (!alive) { cancelAnimation(w); w.value = 2.4; pull.value = 0; return; }
    let t: ReturnType<typeof setTimeout>;
    const cycle = () => {
      w.value = 0;
      pull.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
      // A quick note (≈1.8 s), then it rests on the desk: ~3 s of motion in every ~8 s, not 5 in 7.
      w.value = withDelay(500, withTiming(LINES.length, { duration: 1800, easing: Easing.linear }));
      t = setTimeout(() => {
        pull.value = withTiming(1, { duration: 380, easing: Easing.in(Easing.cubic) });
        t = setTimeout(cycle, 420);
      }, 7400);
    };
    cycle();
    return () => clearTimeout(t);
  }, [alive, w, pull]);

  const sheet = useAnimatedStyle(() => ({ opacity: 1 - pull.value, transform: [{ translateY: pull.value * 46 * k }, { rotate: '-7deg' }] }));
  const pen = useAnimatedStyle(() => {
    const i = Math.min(LINES.length - 1, Math.floor(w.value));
    const f = Math.min(1, Math.max(0, w.value - i));
    const L = LINES[i];
    // Arabic runs right to left: the pen starts at the right end of each line.
    const x = L.x1 - (L.x1 - L.x0) * f;
    const writing = w.value < LINES.length;
    return {
      opacity: 1 - pull.value,
      transform: [
        { translateX: x * k },
        { translateY: (L.y + (writing ? Math.sin(w.value * 38) * 1.4 : -6)) * k },
      ],
    };
  });

  return (
    <View style={{ position: 'absolute', left: SHEET.x * k, top: SHEET.y * k, width: SHEET.w * k, height: SHEET.h * k }}>
      <Animated.View style={[StyleSheet.absoluteFill, sheet]}>
        <Svg width={SHEET.w * k} height={SHEET.h * k} viewBox={`0 0 ${SHEET.w} ${SHEET.h}`}>
          <Rect x={0} y={0} width={SHEET.w} height={SHEET.h} rx={4} fill={PAGE} stroke="#E5DDC8" strokeWidth={1.5} />
          <Rect x={0} y={0} width={SHEET.w} height={14} rx={4} fill="#E9E1CC" />
        </Svg>
        {LINES.map((L, i) => <InkLine key={i} L={L} i={i} w={w} k={k} />)}
        {/* The pen, its nib at (0, 0) of this box. */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }, pen]}>
          <View style={{ position: 'absolute', left: -2 * k, top: -60 * k, transform: [{ rotate: '-35deg' }], transformOrigin: [2 * k, 60 * k, 0] }}>
            <Svg width={12 * k} height={62 * k} viewBox="0 0 12 62">
              <Rect x={2} y={0} width={8} height={46} rx={3} fill={NAVY} />
              <Rect x={2} y={0} width={8} height={10} rx={3} fill={GOLD} />
              <Path d="M2 46 L6 60 L10 46 Z" fill={GOLD} />
            </Svg>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function InkLine({ L, i, w, k }: { L: { y: number; x0: number; x1: number }; i: number; w: { value: number }; k: number }) {
  // Revealed from its right end as the pen moves left.
  const st = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.min(1, Math.max(0, w.value - i)) }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [L.x1 * k, L.y * k, 0] }, st]}>
      <Svg width={SHEET.w * k} height={SHEET.h * k} viewBox={`0 0 ${SHEET.w} ${SHEET.h}`}>
        <Path d={`M${L.x0} ${L.y} H${L.x1}`} stroke={NAVY} strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

// ───────────── the stamp ─────────────
// Slip: x 142…258, y 338…378. Mark at (218, 358). Handle base touches y 356.
function StampDesk({ k, alive }: { k: number; alive: boolean }) {
  const lift = useSharedValue(1); // 1 = raised … 0 = pressed
  const mark = useSharedValue(0);
  const slip = useSharedValue(0); // 1 = slid away
  useEffect(() => {
    if (!alive) { lift.value = 1; mark.value = 0.9; slip.value = 0; return; }
    let t: ReturnType<typeof setTimeout>;
    const cycle = () => {
      mark.value = 0;
      slip.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) });
      lift.value = withDelay(700, withSequence(
        withTiming(1.25, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 110, easing: Easing.in(Easing.quad) }),
        withDelay(160, withSpring(1, { damping: 9, stiffness: 160 })),
      ));
      mark.value = withDelay(1075, withTiming(0.92, { duration: 90 }));
      t = setTimeout(() => {
        slip.value = withTiming(1, { duration: 360, easing: Easing.in(Easing.cubic) });
        t = setTimeout(cycle, 400);
      }, 6800); // one stamp every ~7 s, not every 3.6
    };
    cycle();
    return () => clearTimeout(t);
  }, [alive, lift, mark, slip]);
  const handle = useAnimatedStyle(() => ({ transform: [{ translateY: -24 * k * lift.value }, { rotate: `${-6 * lift.value}deg` }] }));
  const markSt = useAnimatedStyle(() => ({ opacity: mark.value * (1 - slip.value) }));
  const slipSt = useAnimatedStyle(() => ({ opacity: 1 - slip.value, transform: [{ translateX: slip.value * 60 * k }] }));
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, slipSt]}>
        <Svg width={400 * k} height={400 * k} viewBox="0 0 400 400">
          <Rect x={142} y={338} width={116} height={40} rx={4} fill={PAGE} stroke="#E5DDC8" strokeWidth={1.5} />
          <G stroke={RULE} strokeWidth={1.6} strokeLinecap="round"><Path d="M152 350 H196 M152 360 H190 M152 370 H184" /></G>
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: (218 - 15) * k, top: (358 - 15) * k, width: 30 * k, height: 30 * k }, markSt]}>
        <Image source={STAMP_RED} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: (218 - 18) * k, top: (356 - 46) * k, width: 36 * k, height: 46 * k, transformOrigin: [18 * k, 46 * k, 0] }, handle]}>
        <Svg width={36 * k} height={46 * k} viewBox="0 0 36 46">
          <Ellipse cx={18} cy={13} rx={11} ry={13} fill="#8B5A35" />
          <Rect x={5} y={20} width={26} height={14} rx={3} fill="#7A4A2A" />
          <Rect x={0} y={34} width={36} height={10} rx={2} fill={RED} />
        </Svg>
      </Animated.View>
    </>
  );
}
