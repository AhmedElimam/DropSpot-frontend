import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Path } from 'react-native-svg';
import Animated, {
  Easing, Extrapolation, cancelAnimation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { spacing, radius, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { NazerFace } from './NazerFace';
import { useUnlockSound } from './unlockSound';

export type UnlockPhase = 'lock' | 'crack' | 'reveal' | 'done';

const FACE = 132;
const RAYS = 360;
const LOCKED = require('../../../assets/images/nazer/locked.webp');
/** His crest (the line-art stamp) as a watermark in the band's own navy, a shade lighter. */
const CREST = require('../../../assets/images/nazer/stamp-navy.webp');
const CREST_TINT = 'rgba(255,255,255,0.07)';
const GOLD = '#E8C55A';

// Fixed, so every phone plays the same show (and nothing is random per render).
const SPARKS = Array.from({ length: 14 }, (_, i) => ({ a: (i * 26 + ((i * 37) % 11)) * (Math.PI / 180), d: 78 + ((i * 53) % 60), s: 4 + ((i * 7) % 4) }));
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  x: ((i * 37) % 100) / 100, r: (i * 47) % 360, d: ((i * 13) % 10) / 22, w: i % 3 === 0 ? 6 : 8,
  c: ['#C9A227', '#F2EFE6', GOLD, '#7C8BE0', '#E06A75'][i % 5],
}));
const RAY_PATHS = Array.from({ length: 16 }, (_, i) => {
  const a = (i * 22.5 * Math.PI) / 180, h = (5 * Math.PI) / 180, c = RAYS / 2, r = RAYS / 2;
  return `M${c} ${c} L${(c + r * Math.cos(a - h)).toFixed(1)} ${(c + r * Math.sin(a - h)).toFixed(1)} L${(c + r * Math.cos(a + h)).toFixed(1)} ${(c + r * Math.sin(a + h)).toFixed(1)} Z`;
});

/**
 * الناظر's unlock, played like a game (founder 2026-10-22: «make hype of the unlocking, like
 * video games when you unlock a character»): his silhouette rumbles under a gold padlock while
 * rays gather («شخصية جديدة…») — and then he WAITS, locked, until it is opened, like his frame
 * on the website (founder 2026-10-23: «it stays on until unlocking»). A tap on him or on
 * «اضغط لفتح الشخصية» breaks the padlock in full view: it jumps, springs open, a gold ring bursts
 * off it, it falls away — a flash, he bursts in with a shockwave, sparks and confetti, and
 * «شخصية جديدة انفتحت!» slams in, all to his unlock sound (unlockSound.ts, the website's file).
 * Then his name rises and the popup's card unfolds (`onPhase('done')`). Reduced motion starts at
 * the end. Every motion is a one-shot burst on the UI thread; while he waits, the padlock gives a
 * short shake every few seconds and nothing moves in between. All of it is cancelled when the
 * popup closes.
 */
export function NazerUnlockStage({ play, onPhase }: { play: boolean; onPhase: (p: UnlockPhase) => void }) {
  const { t } = useTranslation();
  const still = useReducedMotion();
  const [phase, setPhase] = useState<UnlockPhase>(still ? 'done' : 'lock');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const shake = useSharedValue(0);
  const lockDrop = useSharedValue(0);
  const shadow = useSharedValue(still ? 0 : 1);
  const face = useSharedValue(still ? 1 : 0.94);
  const flash = useSharedValue(0);
  const wave = useSharedValue(0);
  const burst = useSharedValue(0);
  const fall = useSharedValue(0);
  const rays = useSharedValue(still ? 0.5 : 0);
  const spin = useSharedValue(0);
  const slam = useSharedValue(still ? 1 : 0);
  const name = useSharedValue(still ? 1 : 0);
  const lockPop = useSharedValue(0);
  const lockWiggle = useSharedValue(0);
  const lockRing = useSharedValue(0);
  const values = [shake, lockDrop, shadow, face, flash, wave, burst, fall, rays, spin, slam, name, lockPop, lockWiggle, lockRing];
  const sound = useUnlockSound(play && !still);

  const go = (p: UnlockPhase) => { setPhase(p); onPhase(p); };
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const reveal = () => {
    clear();
    values.forEach((v) => cancelAnimation(v));
    shake.value = withTiming(0, { duration: 80 });
    if (lockDrop.value < 1) lockDrop.value = withTiming(1, { duration: 200, easing: Easing.in(Easing.quad) });
    flash.value = withSequence(withTiming(0.95, { duration: 110 }), withTiming(0, { duration: 520 }));
    shadow.value = withTiming(0, { duration: 260 });
    face.value = withSequence(withTiming(0.62, { duration: 1 }), withSpring(1, { damping: 7, stiffness: 160, mass: 0.7 }));
    wave.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    burst.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) });
    fall.value = withTiming(1, { duration: 2400, easing: Easing.in(Easing.quad) });
    rays.value = withTiming(1, { duration: 700 });
    spin.value = withTiming(1, { duration: 6000, easing: Easing.out(Easing.quad) });
    slam.value = withSequence(withTiming(0, { duration: 1 }), withSpring(1, { damping: 8, stiffness: 220 }));
    name.value = withDelay(350, withTiming(1, { duration: 420 }));
    go('reveal');
    timers.current.push(setTimeout(() => {
      rays.value = withTiming(0.55, { duration: 1400 });
      go('done');
    }, 1250));
  };

  // The padlock breaks in full view, then he bursts in on the sound's chime (CHIME_AT).
  const crack = () => {
    if (phase !== 'lock') return;
    clear();
    sound(0);
    cancelAnimation(lockWiggle);
    lockWiggle.value = withTiming(0, { duration: 60 });
    shake.value = withSequence(withTiming(-3, { duration: 50 }), withTiming(3, { duration: 60 }), withTiming(0, { duration: 60 }));
    lockPop.value = withSequence(withTiming(1, { duration: 170, easing: Easing.out(Easing.back(2)) }), withDelay(200, withTiming(1, { duration: 1 })));
    lockRing.value = withSequence(withTiming(0, { duration: 1 }), withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    lockDrop.value = withDelay(380, withTiming(1, { duration: 420, easing: Easing.in(Easing.quad) }));
    rays.value = withTiming(0.8, { duration: 600 });
    go('crack');
    timers.current.push(setTimeout(reveal, 820));
  };

  // While he waits: a short shake of the padlock every few seconds, never while the app is away.
  useEffect(() => {
    if (!play || still || phase !== 'lock') return;
    let alive = true;
    const nudge = () => {
      if (!alive) return;
      if (AppState.currentState === 'active') {
        lockWiggle.value = withSequence(...[10, -9, 7, -5, 3, 0].map((a) => withTiming(a, { duration: 70 })));
      }
      wait = setTimeout(nudge, 3200);
    };
    let wait = setTimeout(nudge, 1900);
    return () => { alive = false; clearTimeout(wait); cancelAnimation(lockWiggle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, still, phase]);

  useEffect(() => {
    if (!play) {
      clear();
      values.forEach((v) => cancelAnimation(v));
      return;
    }
    if (still) { go('done'); return; }
    go('lock');
    // The rumble grows: each swing a little wider than the last, about a second in all.
    const swings = [1, -2, 3, -4, 5, -6, 7, -7, 8, -8].map((a, i) => withTiming(a, { duration: 70 + i * 6 }));
    shake.value = withSequence(withTiming(0, { duration: 120 }), ...swings);
    rays.value = withTiming(0.45, { duration: 700 });
    face.value = withTiming(1.06, { duration: 1150, easing: Easing.in(Easing.quad) });
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, still]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { rotate: `${shake.value * 0.4}deg` }, { scale: face.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({ opacity: shadow.value, transform: [{ scale: 1 + (1 - shadow.value) * 0.25 }] }));
  const lockStyle = useAnimatedStyle(() => ({
    opacity: 1 - lockDrop.value,
    transform: [
      { translateY: lockDrop.value * 80 - lockPop.value * 12 }, { rotate: `${lockDrop.value * 40 + lockWiggle.value - lockPop.value * 8}deg` },
      { scale: 1 + lockPop.value * 0.28 - lockDrop.value * 0.5 },
    ],
  }));
  const lockRingStyle = useAnimatedStyle(() => ({ opacity: lockRing.value === 0 ? 0 : 0.9 * (1 - lockRing.value), transform: [{ scale: 1 + lockRing.value * 1.1 }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const waveStyle = useAnimatedStyle(() => ({ opacity: wave.value === 0 ? 0 : 1 - wave.value, transform: [{ scale: 0.9 + wave.value * 1.4 }] }));
  const raysStyle = useAnimatedStyle(() => ({ opacity: rays.value, transform: [{ scale: 0.6 + rays.value * 0.45 }, { rotate: `${spin.value * 100}deg` }] }));
  const slamStyle = useAnimatedStyle(() => ({ opacity: interpolate(slam.value, [0, 0.4], [0, 1], Extrapolation.CLAMP), transform: [{ scale: interpolate(slam.value, [0, 1], [2.4, 1]) }] }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: name.value, transform: [{ translateY: (1 - name.value) * 10 }] }));

  const locked = phase === 'lock';
  const closed = phase === 'lock' || phase === 'crack';
  return (
    <LinearGradient colors={[...gradients.auth]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ alignItems: 'center', paddingTop: 32 + spacing.md, paddingBottom: spacing.lg, overflow: 'hidden' }}>
      <Image source={CREST} tintColor={CREST_TINT} contentFit="contain" accessible={false}
        style={{ position: 'absolute', width: 300, height: 300, top: 6, alignSelf: 'center' }} />

      {/* «شخصية جديدة…» while locked; «انفتحت!» slams in at the reveal. */}
      {closed ? (
        <View style={{ borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4, borderWidth: 1.5, borderColor: 'rgba(201,162,39,0.7)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: GOLD }}>{t('nazer_unlock.badge_wait')}</Text>
        </View>
      ) : (
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#C9A227', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 }, slamStyle]}>
          <Icon name="success" size={13} color="#1A2147" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#1A2147' }}>{t('nazer_unlock.badge')}</Text>
        </Animated.View>
      )}

      <Pressable onPress={locked ? crack : undefined} accessibilityRole={locked ? 'button' : undefined} accessibilityLabel={locked ? t('nazer_unlock.tap_to_open') : undefined}
        style={{ marginTop: spacing.md, width: FACE, height: FACE, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View pointerEvents="none" style={[styles.center, { width: RAYS, height: RAYS, marginLeft: -RAYS / 2, marginTop: -RAYS / 2 }, raysStyle]}>
          <Svg width={RAYS} height={RAYS}>
            <Defs>
              <RadialGradient id="nzRay" cx="50%" cy="50%" r="50%">
                <Stop offset="0.12" stopColor={GOLD} stopOpacity="0.55" />
                <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            {RAY_PATHS.map((d) => <Path key={d} d={d} fill="url(#nzRay)" />)}
          </Svg>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.center, { width: FACE, height: FACE, marginLeft: -FACE / 2, marginTop: -FACE / 2, borderRadius: FACE / 2, borderWidth: 4, borderColor: '#FFE08A' }, waveStyle]} />
        <Animated.View style={shakeStyle}>
          <NazerFace mood="neutral" size={FACE} blink={phase === 'done'} />
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, shadowStyle]}>
            <Image source={LOCKED} style={{ width: FACE, height: FACE }} contentFit="contain" accessible={false} />
          </Animated.View>
        </Animated.View>
        {SPARKS.map((s, i) => <Spark key={i} spark={s} burst={burst} />)}
        {closed || phase === 'reveal' ? (
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', bottom: -18, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 }, lockStyle]}>
            <Animated.View style={[{ position: 'absolute', width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: '#FFE08A' }, lockRingStyle]} />
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#C9A227', borderWidth: 3, borderColor: '#1A2147', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={locked ? 'lock' : 'unlock'} size={20} color="#1A2147" />
            </View>
          </Animated.View>
        ) : null}
      </Pressable>

      {/* While locked, the call to open him (the website frame's «اضغط لفتح الشخصية»); his name rises in its place. */}
      <View style={{ marginTop: spacing.lg, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}>
        {closed ? (
          <Pressable onPress={locked ? crack : undefined} accessibilityRole="button" hitSlop={8}
            style={({ pressed }) => ({ backgroundColor: '#C9A227', borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: 10, opacity: phase === 'crack' ? 0.6 : pressed ? 0.85 : 1 })}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#1A2147' }}>{t('nazer_unlock.tap_to_open')}</Text>
          </Pressable>
        ) : (
          <Animated.View style={[{ alignItems: 'center' }, nameStyle]}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: '#FFFFFF' }}>{t('nazer.name')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>{t('nazer.role')}</Text>
          </Animated.View>
        )}
      </View>

      {CONFETTI.map((c, i) => <Confetto key={i} piece={c} fall={fall} />)}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF6D6' }, flashStyle]} />
    </LinearGradient>
  );
}

function Spark({ spark, burst }: { spark: (typeof SPARKS)[number]; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: burst.value === 0 || burst.value === 1 ? 0 : 1 - burst.value * burst.value,
    transform: [{ translateX: Math.cos(spark.a) * spark.d * burst.value }, { translateY: Math.sin(spark.a) * spark.d * burst.value }, { scale: 1.2 - burst.value * 0.9 }],
  }));
  return (
    <Animated.View pointerEvents="none"
      style={[styles.center, { width: spark.s, height: spark.s, marginLeft: -spark.s / 2, marginTop: -spark.s / 2, borderRadius: spark.s, backgroundColor: '#FFE08A' }, style]} />
  );
}

function Confetto({ piece, fall }: { piece: (typeof CONFETTI)[number]; fall: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (fall.value - piece.d) / (1 - piece.d)));
    return {
      opacity: p === 0 || p === 1 ? 0 : p < 0.85 ? 1 : (1 - p) / 0.15,
      transform: [{ translateY: p * 380 }, { translateX: p * 18 }, { rotate: `${piece.r + p * 540}deg` }],
    };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -12, left: `${piece.x * 100}%`, width: piece.w, height: 12, borderRadius: 2, backgroundColor: piece.c }, style]} />;
}

/** The card below the stage, rising in once he is out. */
export function RiseIn({ show, children }: { show: boolean; children: ReactNode }) {
  const v = useSharedValue(show ? 1 : 0);
  useEffect(() => { v.value = show ? withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }) : 0; }, [show, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 16 }] }));
  if (!show) return null;
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: '50%', top: '50%' },
});

