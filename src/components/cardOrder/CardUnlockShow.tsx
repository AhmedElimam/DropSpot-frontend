import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Path } from 'react-native-svg';
import Animated, {
  Easing, Extrapolation, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue,
  withDelay, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { radius, spacing, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useUnlockSound } from '@/components/nazer/unlockSound';
import { DsCard3D, CARD_RATIO } from './DsCard3D';

export type CardRect = { x: number; y: number; width: number; height: number };

const GOLD = '#E8C55A';
const LOCK = 76;

// Fixed, so every phone plays the same show.
const SPARKS = Array.from({ length: 18 }, (_, i) => ({ a: (i * 20 + ((i * 37) % 11)) * (Math.PI / 180), d: 150 + ((i * 53) % 90), s: 5 + ((i * 7) % 5) }));
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  x: ((i * 37) % 100) / 100, r: (i * 47) % 360, d: ((i * 13) % 10) / 20, w: i % 3 === 0 ? 7 : 9,
  c: ['#C9A227', '#F2EFE6', GOLD, '#7C8BE0', '#E06A75'][i % 5],
}));

/** The gold rays behind a revealed item. */
export function Rays({ size }: { size: number }) {
  const c = size / 2;
  const paths = Array.from({ length: 16 }, (_, i) => {
    const a = (i * 22.5 * Math.PI) / 180, h = (5 * Math.PI) / 180;
    return `M${c} ${c} L${(c + c * Math.cos(a - h)).toFixed(1)} ${(c + c * Math.sin(a - h)).toFixed(1)} L${(c + c * Math.cos(a + h)).toFixed(1)} ${(c + c * Math.sin(a + h)).toFixed(1)} Z`;
  });
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="cuRay" cx="50%" cy="50%" r="50%">
          <Stop offset="0.12" stopColor={GOLD} stopOpacity="0.55" />
          <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {paths.map((d) => <Path key={d} d={d} fill="url(#cuRay)" />)}
    </Svg>
  );
}

// The show's clock, in ms from the tap (founder 2026-11-07: «take the whole screen … then it
// closes up slowly to the card … make the hype and flip slower»).
const GROW = 750;           // the popup's card grows to the middle of a full screen
const CRACK_AT = GROW + 150; // the padlock breaks (the sound's latch)
const REVEAL_AT = CRACK_AT + 820; // the chime: flash, the card spins in
const SPIN = 3400;          // two full turns, slowing into the front
const READY_AT = REVEAL_AT + SPIN; // «ده إيه؟» comes up; the screen waits for it
const SHRINK = 1300;        // the screen closes up onto the popup's card

/**
 * The Dros Spot card's level-up, full screen. It starts as the popup's own locked card (`from`),
 * which grows into the middle of a navy screen; the padlock breaks to الناظر's unlock sound, a
 * flash, and the card spins in twice and lands front-up with sparks, confetti and «LEVEL UP».
 * Then it waits on the card (a tap turns it over) until «ده إيه؟» is pressed (founder 2026-11-07):
 * it closes up slowly, the screen fading while the card shrinks back onto the popup's card
 * (`target()` reads where that is once the popup has laid its text out), and `onLanded` hands
 * back to the popup, which explains it. Every motion is a one-shot on the UI thread, cancelled on unmount.
 */
export function CardUnlockShow({ from, target, onCollapse, onLanded }: {
  from: CardRect | null;
  target: () => Promise<CardRect | null>;
  onCollapse: () => void;
  onLanded: () => void;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const W = Math.min(width * 0.6, 250);
  const H = W * CARD_RATIO;
  const cx = width / 2;
  const cy = height * 0.45;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sound = useUnlockSound(true);
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const closing = useRef(false);
  const faceUp = useRef(true);

  // Where the card is: offset from the middle, and its scale against the big card.
  const fromX = from ? from.x + from.width / 2 - cx : 0;
  const fromY = from ? from.y + from.height / 2 - cy : height * 0.1;
  const fromS = from ? from.width / W : 0.5;
  const fx = useSharedValue(fromX);
  const fy = useSharedValue(fromY);
  const fs = useSharedValue(fromS);
  const bg = useSharedValue(0);
  const turn = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const sheen = useSharedValue(0);
  const dark = useSharedValue(1);
  const pop = useSharedValue(1);
  const flash = useSharedValue(0);
  const wave = useSharedValue(0);
  const burst = useSharedValue(0);
  const fall = useSharedValue(0);
  const rays = useSharedValue(0);
  const spin = useSharedValue(0);
  const slam = useSharedValue(0);
  const title = useSharedValue(0);
  const lockDrop = useSharedValue(0);
  const lockPop = useSharedValue(0);
  const lockRing = useSharedValue(0);
  const fade = useSharedValue(1);
  const ask = useSharedValue(0);

  useEffect(() => {
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    const inOut = Easing.inOut(Easing.cubic);

    // 1. The popup's card grows into the middle of a full screen.
    fx.value = withTiming(0, { duration: GROW, easing: inOut });
    fy.value = withTiming(0, { duration: GROW, easing: inOut });
    fs.value = withTiming(1, { duration: GROW, easing: inOut });
    bg.value = withTiming(1, { duration: GROW * 0.7 });
    rays.value = withTiming(0.45, { duration: GROW });

    // 2. The padlock breaks.
    at(CRACK_AT, () => {
      sound(0);
      lockPop.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.back(2)) });
      lockRing.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
      lockDrop.value = withDelay(420, withTiming(1, { duration: 450, easing: Easing.in(Easing.quad) }));
      rays.value = withTiming(0.8, { duration: 700 });
    });

    // 3. The chime: a flash, and the card spins in.
    at(REVEAL_AT, () => {
      flash.value = withSequence(withTiming(0.95, { duration: 120 }), withTiming(0, { duration: 700 }));
      dark.value = withTiming(0, { duration: 380 });
      turn.value = withTiming(720, { duration: SPIN, easing: Easing.out(Easing.cubic) });
      pop.value = withSequence(withTiming(0.6, { duration: 1 }), withSpring(1.06, { damping: 9, stiffness: 90, mass: 1 }), withTiming(1, { duration: 500 }));
      wave.value = withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) });
      burst.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });
      fall.value = withTiming(1, { duration: 4200, easing: Easing.in(Easing.quad) });
      rays.value = withTiming(1, { duration: 900 });
      spin.value = withTiming(1, { duration: 9000, easing: Easing.out(Easing.quad) });
      slam.value = withDelay(500, withSpring(1, { damping: 8, stiffness: 160 }));
      title.value = withDelay(1300, withTiming(1, { duration: 600 }));
      sheen.value = withDelay(SPIN - 300, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }));
      tiltX.value = withDelay(SPIN - 600, withSequence(withTiming(7, { duration: 900 }), withTiming(0, { duration: 900 })));
    });

    // 4. The card is in: «ده إيه؟» comes up, and the screen waits for it.
    at(READY_AT, () => {
      turn.value = 0; // 720 ≡ 0
      setReady(true);
      ask.value = withTiming(1, { duration: 500 });
    });

    const all = [fx, fy, fs, bg, turn, tiltX, sheen, dark, pop, flash, wave, burst, fall, rays, spin, slam, title, lockDrop, lockPop, lockRing, fade, ask];
    return () => { timers.current.forEach(clearTimeout); timers.current = []; all.forEach((v) => cancelAnimation(v)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A tap on the landed card turns it over. */
  const flip = () => {
    if (!ready || closing.current) return;
    faceUp.current = !faceUp.current;
    turn.value = withSpring(faceUp.current ? 0 : 180, { damping: 14, stiffness: 70 });
  };

  /** «ده إيه؟»: the screen closes up onto the popup's card, front up. */
  const collapse = () => {
    if (!ready || closing.current) return;
    closing.current = true;
    const inOut = Easing.inOut(Easing.cubic);
    ask.value = withTiming(0, { duration: 200 });
    onCollapse();
    // Two frames for the popup to lay out its text, then read where its card now sits. The modal
    // covers the whole window (statusBarTranslucent), so window points are ours.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      void target().then((rect) => {
        const tx = rect ? rect.x + rect.width / 2 - cx : 0;
        const ty = rect ? rect.y + rect.height / 2 - cy : height * 0.1;
        const ts = rect ? rect.width / W : 0.5;
        turn.value = withTiming(0, { duration: SHRINK, easing: inOut });
        fx.value = withTiming(tx, { duration: SHRINK, easing: inOut });
        fy.value = withTiming(ty, { duration: SHRINK, easing: inOut });
        fs.value = withTiming(ts, { duration: SHRINK, easing: inOut });
        fade.value = withTiming(0, { duration: SHRINK * 0.8, easing: Easing.in(Easing.quad) });
        timers.current.push(setTimeout(onLanded, SHRINK + 60));
      });
    }));
  };

  const askStyle = useAnimatedStyle(() => ({ opacity: ask.value, transform: [{ translateY: (1 - ask.value) * 18 }] }));
  const bgStyle = useAnimatedStyle(() => ({ opacity: bg.value * fade.value }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fx.value }, { translateY: fy.value }, { scale: fs.value * pop.value }],
  }));
  const raysStyle = useAnimatedStyle(() => ({ opacity: rays.value * fade.value, transform: [{ scale: 0.6 + rays.value * 0.5 }, { rotate: `${spin.value * 120}deg` }] }));
  const lockStyle = useAnimatedStyle(() => ({
    opacity: 1 - lockDrop.value,
    transform: [{ translateY: lockDrop.value * 140 - lockPop.value * 16 }, { rotate: `${lockDrop.value * 45 - lockPop.value * 10}deg` }, { scale: 1 + lockPop.value * 0.3 - lockDrop.value * 0.5 }],
  }));
  const lockRingStyle = useAnimatedStyle(() => ({ opacity: lockRing.value === 0 ? 0 : 0.9 * (1 - lockRing.value), transform: [{ scale: 1 + lockRing.value * 1.4 }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const waveStyle = useAnimatedStyle(() => ({ opacity: wave.value === 0 ? 0 : (1 - wave.value) * fade.value, transform: [{ scale: 0.9 + wave.value * 1.8 }] }));
  const slamStyle = useAnimatedStyle(() => ({ opacity: interpolate(slam.value, [0, 0.4], [0, 1], Extrapolation.CLAMP) * fade.value, transform: [{ scale: interpolate(slam.value, [0, 1], [2.6, 1]) }] }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: title.value * fade.value, transform: [{ translateY: (1 - title.value) * 14 }] }));

  const raySize = Math.max(width, height) * 1.1;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, bgStyle]}>
        <LinearGradient colors={[...gradients.auth]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: cx - raySize / 2, top: cy - raySize / 2, width: raySize, height: raySize }, raysStyle]}>
        <Rays size={raySize} />
      </Animated.View>

      {/* «LEVEL UP» over the card, its name under it. */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: cy - H / 2 - 64, left: 0, right: 0, alignItems: 'center' }, slamStyle]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#C9A227', borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: 8 }}>
          <Icon name="levelUp" size={20} color="#1A2147" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#1A2147' }}>{t('card_unlock.badge')}</Text>
        </View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: cy + H / 2 + 28, left: 0, right: 0, alignItems: 'center' }, titleStyle]}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: '#FFFFFF' }}>{t('card_unlock.item_name')}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>{t('card_unlock.show_sub')}</Text>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: cx - W / 2, top: cy - H / 2, width: W, height: H, borderRadius: 18, borderWidth: 5, borderColor: '#FFE08A' }, waveStyle]} />
      <View pointerEvents="none" style={{ position: 'absolute', left: cx, top: cy }}>
        {SPARKS.map((s, i) => <Spark key={i} spark={s} burst={burst} />)}
      </View>

      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: cx - W / 2, top: cy - H / 2, width: W, height: H, alignItems: 'center', justifyContent: 'center' }, cardStyle]}>
        <DsCard3D width={W} turn={turn} tiltX={tiltX} sheen={sheen} dark={dark} />
        <Animated.View style={[{ position: 'absolute', width: LOCK, height: LOCK, alignItems: 'center', justifyContent: 'center' }, lockStyle]}>
          <Animated.View style={[{ position: 'absolute', width: LOCK + 8, height: LOCK + 8, borderRadius: (LOCK + 8) / 2, borderWidth: 4, borderColor: '#FFE08A' }, lockRingStyle]} />
          <View style={{ width: LOCK, height: LOCK, borderRadius: LOCK / 2, backgroundColor: '#C9A227', borderWidth: 4, borderColor: '#1A2147', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="unlock" size={34} color="#1A2147" />
          </View>
        </Animated.View>
      </Animated.View>

      {/* The landed card turns over on a tap. */}
      {ready ? (
        <Pressable onPress={flip} accessibilityRole="button" accessibilityLabel={t('card_unlock.tap_to_flip')}
          style={{ position: 'absolute', left: cx - W / 2, top: cy - H / 2, width: W, height: H }} />
      ) : null}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fadeStyle]}>
        {CONFETTI.map((c, i) => <Confetto key={i} piece={c} fall={fall} height={height} />)}
      </Animated.View>
      {/* «ده إيه؟» — the way back to the popup, which says what the card is. */}
      <Animated.View pointerEvents={ready ? 'box-none' : 'none'} style={[{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + spacing.xl4, alignItems: 'center' }, askStyle]}>
        <Pressable onPress={collapse} accessibilityRole="button" hitSlop={10}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#C9A227', borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: 14, opacity: pressed ? 0.85 : 1 })}>
          <Icon name="help" size={20} color="#1A2147" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#1A2147' }}>{t('card_unlock.what_is_it')}</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: spacing.sm }}>{t('card_unlock.tap_to_flip')}</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF6D6' }, flashStyle]} />
    </View>
  );
}

function Spark({ spark, burst }: { spark: (typeof SPARKS)[number]; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: burst.value === 0 || burst.value === 1 ? 0 : 1 - burst.value * burst.value,
    transform: [{ translateX: Math.cos(spark.a) * spark.d * burst.value }, { translateY: Math.sin(spark.a) * spark.d * burst.value }, { scale: 1.3 - burst.value * 0.9 }],
  }));
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: 'absolute', width: spark.s, height: spark.s, marginLeft: -spark.s / 2, marginTop: -spark.s / 2, borderRadius: spark.s, backgroundColor: '#FFE08A' }, style]} />
  );
}

function Confetto({ piece, fall, height }: { piece: (typeof CONFETTI)[number]; fall: SharedValue<number>; height: number }) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (fall.value - piece.d) / (1 - piece.d)));
    return {
      opacity: p === 0 || p === 1 ? 0 : p < 0.85 ? 1 : (1 - p) / 0.15,
      transform: [{ translateY: p * (height + 40) }, { translateX: p * 24 }, { rotate: `${piece.r + p * 620}deg` }],
    };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -14, left: `${piece.x * 100}%`, width: piece.w, height: 14, borderRadius: 2, backgroundColor: piece.c }, style]} />;
}
