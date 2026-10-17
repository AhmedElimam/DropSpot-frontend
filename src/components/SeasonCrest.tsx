import { memo, useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Circle, Defs, Ellipse, G, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { REVISION_INK } from '@/theme/revision';

/**
 * The season's crest — «موسم المراجعة» as a seal of our own (founder 2026-10-17: «our own crest
 * on the activation screen when I toggle, and our own design on that screen, animated»). The
 * same heraldic language as مدام روز's crest, so the two belong to one house: a deep indigo
 * SHIELD with a gold bevelled border carrying the Dros Spot emblem in gold, the season's paper
 * inside it (ruled lines and the amber margin line of an answer sheet), an OPEN BOOK for its
 * crown, a gold LAUREL wreath round it, and an amber MOTTO SCROLL «موسم المراجعة» under it.
 * No stars (a house rule), no violet.
 *
 * `animate`: the crest assembles itself once — the rings ripple out, the shield springs in, the
 * two laurel branches swing up into place, the book settles on top, the emblem lights and a
 * glint crosses it, the scroll unrolls. Every motion is a shared value started on mount with its
 * own delay, so it all runs on the UI thread while the JS thread rebuilds the app underneath the
 * curtain. Without `animate` it is drawn finished (the welcome sheet).
 */

const W = 260;
const H = 300;
const C = { x: 130, y: 150 };
const GOLD = '#C9A227';
const GOLD_LIGHT = '#F3E3A0';
const GOLD_SOFT = '#E3C565';
const EMBLEM = require('../../assets/images/brand-logo.png');

const SHIELD = 'M64 80 H196 V150 C196 196 166 222 130 238 C94 222 64 196 64 150 Z';

/** One laurel branch, as leaves along an arc round the shield. side −1 = left, 1 = right. */
function Branch({ side }: { side: 1 | -1 }) {
  const r = 104;
  // Angles in the SVG's own sense (y down): 90° is straight below the centre, 180° the left.
  // The right branch is the left one mirrored across the centre line.
  const pt = (deg: number, rr = r) => {
    const a = (deg * Math.PI) / 180;
    const x = rr * Math.cos(a);
    return { x: C.x + (side === -1 ? x : -x), y: C.y + rr * Math.sin(a) };
  };
  const leaves = [];
  for (let i = 0; i < 12; i += 1) {
    // From the bottom (just off centre) up the side to the shoulder, leaves in pairs.
    const deg = 104 + i * 12.5;
    const tilt = i % 2 === 0 ? 28 : -28;
    const p = pt(deg, r + (i % 2 === 0 ? 8 : -6));
    // Along the arc, tilted outward like a real sprig; mirrored for the right branch.
    const along = deg + 90 + tilt;
    const rot = side === -1 ? along : 180 - along;
    leaves.push(<Ellipse key={i} cx={p.x} cy={p.y} rx={13} ry={5.6} fill={i % 2 === 0 ? GOLD : GOLD_SOFT} transform={`rotate(${rot} ${p.x} ${p.y})`} />);
  }
  const p0 = pt(100);
  const p1 = pt(250);
  return (
    <G>
      <Path d={`M${p0.x} ${p0.y} A${r} ${r} 0 0 ${side === -1 ? 1 : 0} ${p1.x} ${p1.y}`} stroke={GOLD} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {leaves}
      {[2, 5, 8].map((i) => {
        const p = pt(110 + i * 15, r + 15);
        return <Circle key={`b${i}`} cx={p.x} cy={p.y} r={3} fill={REVISION_INK.amber} />;
      })}
    </G>
  );
}

function BranchSvg({ side, size }: { side: 1 | -1; size: number }) {
  return (
    <Svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <Branch side={side} />
    </Svg>
  );
}

export const SeasonCrest = memo(function SeasonCrest({ size = 220, animate = false }: { size?: number; animate?: boolean }) {
  const { t } = useTranslation();
  const k = size / W;
  const h = H * k;

  const ring1 = useSharedValue(animate ? 0 : 1);
  const ring2 = useSharedValue(animate ? 0 : 1);
  const shield = useSharedValue(animate ? 0 : 1);
  const laurel = useSharedValue(animate ? 0 : 1);
  const book = useSharedValue(animate ? 0 : 1);
  const emblem = useSharedValue(animate ? 0 : 1);
  const glint = useSharedValue(0);
  const scroll = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    const ease = Easing.out(Easing.cubic);
    ring1.value = withDelay(260, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
    ring2.value = withDelay(620, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
    shield.value = withDelay(140, withSpring(1, { damping: 11, stiffness: 140, mass: 0.8 }));
    laurel.value = withDelay(360, withTiming(1, { duration: 620, easing: ease }));
    book.value = withDelay(560, withSpring(1, { damping: 12, stiffness: 160 }));
    emblem.value = withDelay(520, withTiming(1, { duration: 420, easing: ease }));
    glint.value = withDelay(1050, withSequence(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 0 })));
    scroll.value = withDelay(760, withTiming(1, { duration: 480, easing: ease }));
  }, [animate, ring1, ring2, shield, laurel, book, emblem, glint, scroll]);

  const r1 = useAnimatedStyle(() => ({ opacity: ring1.value === 0 ? 0 : 0.7 * (1 - ring1.value), transform: [{ scale: 0.55 + ring1.value * 0.95 }] }));
  const r2 = useAnimatedStyle(() => ({ opacity: ring2.value === 0 ? 0 : 0.7 * (1 - ring2.value), transform: [{ scale: 0.55 + ring2.value * 0.95 }] }));
  const shieldStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, shield.value * 1.6), transform: [{ scale: 0.55 + shield.value * 0.45 }] }));
  const leftStyle = useAnimatedStyle(() => ({ opacity: laurel.value, transform: [{ rotate: `${(1 - laurel.value) * -38}deg` }, { scale: 0.85 + laurel.value * 0.15 }] }));
  const rightStyle = useAnimatedStyle(() => ({ opacity: laurel.value, transform: [{ rotate: `${(1 - laurel.value) * 38}deg` }, { scale: 0.85 + laurel.value * 0.15 }] }));
  const bookStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, book.value * 1.4), transform: [{ translateY: (1 - book.value) * -22 * k }] }));
  const emblemStyle = useAnimatedStyle(() => ({ opacity: emblem.value, transform: [{ scale: 0.7 + emblem.value * 0.3 }] }));
  const glintStyle = useAnimatedStyle(() => ({ opacity: glint.value > 0 && glint.value < 1 ? 0.55 : 0, transform: [{ translateX: (-70 + glint.value * 140) * k }, { rotate: '18deg' }] }));
  const scrollStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, scroll.value * 2), transform: [{ scaleX: 0.2 + scroll.value * 0.8 }] }));

  const fill = { position: 'absolute' as const, left: 0, top: 0, width: size, height: h };
  const emblemH = 64 * k;

  return (
    <View style={{ width: size, height: h }} accessibilityRole="image" accessibilityLabel={t('revision.season')}>
      {/* The ripple: two amber rings going out once, behind everything. */}
      {animate ? (
        <>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (C.x - 110) * k, top: (C.y - 110) * k, width: 220 * k, height: 220 * k, borderRadius: 110 * k, borderWidth: 2, borderColor: REVISION_INK.amberGlow }, r1]} />
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (C.x - 110) * k, top: (C.y - 110) * k, width: 220 * k, height: 220 * k, borderRadius: 110 * k, borderWidth: 1.5, borderColor: GOLD_LIGHT }, r2]} />
        </>
      ) : null}

      {/* The laurel: two branches that swing up into place. */}
      <Animated.View style={[fill, leftStyle]}><BranchSvg side={-1} size={size} /></Animated.View>
      <Animated.View style={[fill, rightStyle]}><BranchSvg side={1} size={size} /></Animated.View>

      {/* The shield, with the season's paper inside it. */}
      <Animated.View style={[fill, shieldStyle]}>
        <Svg width={size} height={h} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <SvgGradient id="scShield" x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor="#323E9C" />
              <Stop offset="0.55" stopColor={REVISION_INK.indigo} />
              <Stop offset="1" stopColor={REVISION_INK.indigoDeeper} />
            </SvgGradient>
            <ClipPath id="scClip"><Path d={SHIELD} /></ClipPath>
          </Defs>
          <Path d={SHIELD} fill="url(#scShield)" />
          <G clipPath="url(#scClip)">
            {Array.from({ length: 13 }, (_, i) => <Line key={i} x1={60} x2={200} y1={92 + i * 12} y2={92 + i * 12} stroke="#FFFFFF" strokeOpacity={0.07} strokeWidth={1} />)}
            <Line x1={180} x2={180} y1={78} y2={240} stroke={REVISION_INK.amber} strokeOpacity={0.6} strokeWidth={1.6} />
            {/* A soft lamp glow in the upper corner of the field. */}
            <Circle cx={88} cy={96} r={46} fill={REVISION_INK.amberGlow} fillOpacity={0.10} />
          </G>
          <Path d={SHIELD} fill="none" stroke={GOLD} strokeWidth={6} strokeLinejoin="round" />
          <Path d={SHIELD} fill="none" stroke={GOLD_LIGHT} strokeWidth={1.4} strokeLinejoin="round" transform={`translate(${C.x} 157) scale(0.9) translate(${-C.x} -157)`} />
        </Svg>
      </Animated.View>

      {/* The emblem in gold, lit, with one glint across it. */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (C.x - 48) * k, top: (156 - 48) * k, width: 96 * k, height: 96 * k, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 18 * k }, emblemStyle]}>
        <Image source={EMBLEM} style={{ height: emblemH, width: emblemH * 1.14, tintColor: GOLD_SOFT }} resizeMode="contain" />
        <Animated.View style={[{ position: 'absolute', top: -20 * k, bottom: -20 * k, width: 16 * k, backgroundColor: '#FFFFFF' }, glintStyle]} />
      </Animated.View>

      {/* The crown: an open book settling on the shield. */}
      <Animated.View style={[fill, bookStyle]}>
        <Svg width={size} height={h} viewBox={`0 0 ${W} ${H}`}>
          <Path d="M130 76 C114 66 94 65 80 71 L80 44 C94 38 114 39 130 50 Z" fill="#FBF3DF" stroke={GOLD} strokeWidth={2.4} strokeLinejoin="round" />
          <Path d="M130 76 C146 66 166 65 180 71 L180 44 C166 38 146 39 130 50 Z" fill="#FFF8E8" stroke={GOLD} strokeWidth={2.4} strokeLinejoin="round" />
          <Line x1={130} y1={50} x2={130} y2={76} stroke={GOLD} strokeWidth={2} />
          {[0, 1, 2].map((i) => (
            <G key={i}>
              <Path d={`M90 ${51 + i * 6} C102 ${47 + i * 6} 114 ${48 + i * 6} 122 ${53 + i * 6}`} stroke={REVISION_INK.indigo} strokeOpacity={0.35} strokeWidth={1.3} fill="none" />
              <Path d={`M170 ${51 + i * 6} C158 ${47 + i * 6} 146 ${48 + i * 6} 138 ${53 + i * 6}`} stroke={REVISION_INK.indigo} strokeOpacity={0.35} strokeWidth={1.3} fill="none" />
            </G>
          ))}
          {/* A ribbon bookmark in amber, falling from the spine. */}
          <Path d="M134 50 L134 84 L138.5 79 L143 84 L143 52" fill={REVISION_INK.amber} />
        </Svg>
      </Animated.View>

      {/* The motto scroll, unrolling from its centre. */}
      <Animated.View style={[fill, scrollStyle]}>
        <Svg width={size} height={h} viewBox={`0 0 ${W} ${H}`}>
          <Path d="M46 247 L20 252 L31 265 L20 278 L48 273 Z" fill={REVISION_INK.amberDeep} />
          <Path d="M214 247 L240 252 L229 265 L240 278 L212 273 Z" fill={REVISION_INK.amberDeep} />
          <Path d="M40 242 Q130 262 220 242 L220 270 Q130 290 40 270 Z" fill={REVISION_INK.amber} stroke={GOLD} strokeWidth={1.6} />
          <Path d="M46 247 Q130 266 214 247" fill="none" stroke={GOLD_LIGHT} strokeOpacity={0.6} strokeWidth={1} />
        </Svg>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: 250 * k, height: 26 * k, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontFamily: fonts.bold, fontSize: Math.max(10, 15 * k), lineHeight: Math.max(14, 21 * k), color: '#FFFFFF' }} numberOfLines={1}>{t('revision.season')}</Text>
        </View>
      </Animated.View>
    </View>
  );
});
