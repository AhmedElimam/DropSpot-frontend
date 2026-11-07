import { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { radius, spacing, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { DsCard3D, CARD_RATIO } from './DsCard3D';
import { Rays, type CardRect } from './CardUnlockShow';

export const STAGE_CARD_W = 128;
const CARD_H = STAGE_CARD_W * CARD_RATIO;
const GOLD = '#E8C55A';
const CREST = require('../../../assets/images/nazer/stamp-navy.webp');

/**
 * The popup's band for the Dros Spot card's level-up (founder 2026-11-07). Locked: the card as an
 * ink silhouette under a gold padlock that shakes now and then, rays gathering, «اضغط لفتح
 * العنصر». A tap hands over to the full-screen show (CardUnlockShow) with where the card sits, and
 * the band waits under it. `revealed`: the card front-up, «LEVEL UP», and after that a lean and a
 * band of light every few seconds (short bursts, never while the app is away); a tap turns the
 * card over. `hideCard` keeps it out of sight while the show's card lands on it. `measureRef`
 * lets the popup read the card's place again once its own layout has settled.
 */
export function CardUnlockStage({ play, revealed, hideCard, onOpen, measureRef }: {
  play: boolean;
  revealed: boolean;
  hideCard: boolean;
  onOpen: (rect: CardRect | null) => void;
  measureRef?: React.MutableRefObject<(() => Promise<CardRect | null>) | null>;
}) {
  const { t } = useTranslation();
  const still = useReducedMotion();
  const cardBox = useRef<View>(null);
  const faceUp = useRef(true);
  const [opening, setOpening] = useState(false);

  const shake = useSharedValue(0);
  const turn = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const sheen = useSharedValue(0);
  const dark = useSharedValue(revealed ? 0 : 1);
  const rays = useSharedValue(0);
  const lockWiggle = useSharedValue(0);
  const lockPop = useSharedValue(0);
  const values = [shake, turn, tiltX, sheen, dark, rays, lockWiggle, lockPop];

  const measure = () => new Promise<CardRect | null>((resolve) => {
    const node = cardBox.current;
    if (!node) { resolve(null); return; }
    node.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null));
  });
  if (measureRef) measureRef.current = measure;

  const open = () => {
    if (revealed || opening) return;
    setOpening(true);
    cancelAnimation(lockWiggle);
    lockWiggle.value = 0;
    lockPop.value = withSequence(withTiming(1, { duration: 140, easing: Easing.out(Easing.back(2)) }), withTiming(0, { duration: 140 }));
    void measure().then(onOpen);
  };

  const flip = () => {
    if (!revealed) return;
    faceUp.current = !faceUp.current;
    turn.value = withSpring(faceUp.current ? 0 : 180, { damping: 14, stiffness: 70 });
  };

  // Locked: the rumble on arrival, rays gathering.
  useEffect(() => {
    if (!play) { values.forEach((v) => cancelAnimation(v)); return; }
    if (revealed) return;
    setOpening(false);
    faceUp.current = true;
    turn.value = 0;
    dark.value = 1;
    if (still) { rays.value = 0.45; return; }
    const swings = [1, -2, 3, -4, 5, -6, 7, -7, 8, -8].map((a, i) => withTiming(a, { duration: 70 + i * 6 }));
    shake.value = withSequence(withTiming(0, { duration: 120 }), ...swings, withTiming(0, { duration: 80 }));
    rays.value = withTiming(0.45, { duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, still]);

  // Revealed: the final pose, at once (the show has just played the arrival).
  useEffect(() => {
    if (!revealed) return;
    values.forEach((v) => cancelAnimation(v));
    shake.value = 0; dark.value = 0; turn.value = 0; tiltX.value = 0; sheen.value = 0;
    faceUp.current = true;
    rays.value = withTiming(0.55, { duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  // Bursts: the padlock's shake while locked; the lean and the light once revealed.
  useEffect(() => {
    if (!play || still || opening || hideCard) return;
    let alive = true;
    const nudge = () => {
      if (!alive) return;
      if (AppState.currentState === 'active') {
        if (!revealed) {
          lockWiggle.value = withSequence(...[10, -9, 7, -5, 3, 0].map((a) => withTiming(a, { duration: 70 })));
        } else {
          const base = faceUp.current ? 0 : 180;
          const ease = Easing.inOut(Easing.quad);
          turn.value = withSequence(withTiming(base - 14, { duration: 800, easing: ease }), withTiming(base + 10, { duration: 1100, easing: ease }), withTiming(base, { duration: 800, easing: ease }));
          tiltX.value = withSequence(withTiming(6, { duration: 1300, easing: ease }), withTiming(0, { duration: 1300, easing: ease }));
          sheen.value = 0;
          sheen.value = withDelay(500, withTiming(1, { duration: 1000, easing: ease }));
        }
      }
      wait = setTimeout(nudge, revealed ? 4600 : 3200);
    };
    let wait = setTimeout(nudge, revealed ? 2200 : 1900);
    return () => { alive = false; clearTimeout(wait); cancelAnimation(lockWiggle); cancelAnimation(tiltX); cancelAnimation(sheen); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, still, revealed, opening, hideCard]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { rotate: `${shake.value * 0.4}deg` }] }));
  const lockStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${lockWiggle.value}deg` }, { scale: 1 + lockPop.value * 0.25 }] }));
  const raysStyle = useAnimatedStyle(() => ({ opacity: rays.value }));

  return (
    <LinearGradient colors={[...gradients.auth]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ alignItems: 'center', paddingTop: 32 + spacing.md, paddingBottom: spacing.lg, overflow: 'hidden' }}>
      <Image source={CREST} tintColor="rgba(255,255,255,0.07)" contentFit="contain" accessible={false}
        style={{ position: 'absolute', width: 300, height: 300, top: 6, alignSelf: 'center' }} />

      {revealed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#C9A227', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
          <Icon name="levelUp" size={14} color="#1A2147" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#1A2147' }}>{t('card_unlock.badge')}</Text>
        </View>
      ) : (
        <View style={{ borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4, borderWidth: 1.5, borderColor: 'rgba(201,162,39,0.7)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: GOLD }}>{t('card_unlock.badge_wait')}</Text>
        </View>
      )}

      <Pressable onPress={revealed ? flip : open}
        accessibilityRole="button" accessibilityLabel={revealed ? t('card_unlock.tap_to_flip') : t('card_unlock.tap_to_open')}
        style={{ marginTop: spacing.md, width: STAGE_CARD_W + 40, height: CARD_H + 16, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, raysStyle]}>
          <Rays size={380} />
        </Animated.View>
        <Animated.View style={[shakeStyle, { opacity: hideCard ? 0 : 1 }]}>
          <View ref={cardBox} collapsable={false}>
            <DsCard3D width={STAGE_CARD_W} turn={turn} tiltX={tiltX} sheen={sheen} dark={dark} />
          </View>
        </Animated.View>
        {!revealed && !opening ? (
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: '#C9A227', borderWidth: 3, borderColor: '#1A2147', alignItems: 'center', justifyContent: 'center' }, lockStyle]}>
            <Icon name="lock" size={24} color="#1A2147" />
          </Animated.View>
        ) : null}
      </Pressable>

      <View style={{ marginTop: spacing.md, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}>
        {revealed ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: '#FFFFFF' }}>{t('card_unlock.item_name')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.72)' }}>{t('card_unlock.tap_to_flip')}</Text>
          </View>
        ) : (
          <Pressable onPress={open} accessibilityRole="button" hitSlop={8}
            style={({ pressed }) => ({ backgroundColor: '#C9A227', borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: 10, opacity: opening ? 0.6 : pressed ? 0.85 : 1 })}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#1A2147' }}>{t('card_unlock.tap_to_open')}</Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
}
