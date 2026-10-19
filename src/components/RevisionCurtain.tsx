import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { REVISION_INK } from '@/theme/revision';
import { gradientSets } from '@/theme/palettes';
import { CURTAIN_IN_MS, useThemeStore } from '@/stores/themeStore';
import { Icon } from '@/components/ui/Icon';
import { SeasonCrest } from '@/components/SeasonCrest';
import Svg, { Defs, Line, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * The crossing into (or out of) «وضع المراجعة»: a full-screen curtain in the colour of the
 * side being entered rises over the app, the tokens flip and the tree is rebuilt under it,
 * and it falls away over the new colours — a crossfade instead of a hard cut (founder
 * 2026-10-16: «a smooth crossfade when the switch flips»). Lives OUTSIDE the re-keyed tree
 * so the rebuild never unmounts it. Opacity and a small scale only, on the UI thread.
 *
 * Entering has its own screen (founder 2026-10-17): the season's crest (SeasonCrest) assembles
 * itself on the indigo answer sheet, then «وضع المراجعة مفعّل» rises under it. When it falls,
 * the welcome sheet (RevisionWelcome) explains what changed.
 */
const HOLD_MS = 520;
// Entering holds long enough for the crest to assemble and be seen (founder 2026-10-17: «our
// own crest on the activation screen … animated»); leaving stays a quick crossfade.
const HOLD_IN_MS = 1900;
const OUT_MS = 460;

export function RevisionCurtain() {
  const curtain = useThemeStore((s) => s.curtain);
  if (!curtain) return null;
  return <Curtain key={curtain.key} to={curtain.to} />;
}

function Curtain({ to }: { to: boolean }) {
  const { t } = useTranslation();
  const scheme = useThemeStore((s) => s.scheme);
  const o = useSharedValue(0);
  const s = useSharedValue(0.92);
  const title = useSharedValue(0);
  useEffect(() => {
    const done = () => useThemeStore.getState().curtainDone();
    o.value = withSequence(
      withTiming(1, { duration: CURTAIN_IN_MS, easing: Easing.out(Easing.quad) }),
      withDelay(to ? HOLD_IN_MS : HOLD_MS, withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => { if (finished) runOnJS(done)(); })),
    );
    s.value = withTiming(1, { duration: CURTAIN_IN_MS + HOLD_MS, easing: Easing.out(Easing.cubic) });
    title.value = withDelay(900, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [o, s, title, to]);
  const veil = useAnimatedStyle(() => ({ opacity: o.value }));
  const mark = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const rise = useAnimatedStyle(() => ({ opacity: title.value, transform: [{ translateY: (1 - title.value) * 14 }] }));
  if (to) {
    // Entering: the season's own screen — the indigo night, the answer sheet's ruled lines and
    // amber margin, a lamp glow, and the crest assembling itself in the middle.
    return (
      <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { zIndex: 1000 }, veil]} accessibilityLiveRegion="polite" accessibilityLabel={t('revision.curtain_on')}>
        <LinearGradient colors={['#2E3990', REVISION_INK.indigoDeep, REVISION_INK.indigoDeeper]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern id="rcLines" patternUnits="userSpaceOnUse" width={30} height={30}>
              <Line x1={0} y1={29.5} x2={30} y2={29.5} stroke="#FFFFFF" strokeOpacity={0.05} strokeWidth={1} />
            </Pattern>
            <RadialGradient id="rcLamp" cx="50%" cy="42%" r="55%">
              <Stop offset="0" stopColor={REVISION_INK.amberGlow} stopOpacity={0.22} />
              <Stop offset="0.5" stopColor={REVISION_INK.amber} stopOpacity={0.07} />
              <Stop offset="1" stopColor={REVISION_INK.amber} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#rcLines)" />
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#rcLamp)" />
        </Svg>
        <View style={{ position: 'absolute', top: 0, bottom: 0, start: 26, width: 1.5, backgroundColor: REVISION_INK.amber, opacity: 0.35 }} />
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
          <Animated.View style={mark}><SeasonCrest size={240} animate /></Animated.View>
          <Animated.View style={[{ alignItems: 'center', marginTop: 22 }, rise]}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 25, lineHeight: 34, color: '#FFFFFF', textAlign: 'center' }}>{t('revision.curtain_on')}</Text>
            <View style={{ width: 44, height: 3, borderRadius: 2, backgroundColor: REVISION_INK.amber, marginVertical: 10 }} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 22, color: 'rgba(255,255,255,0.76)', textAlign: 'center' }}>{t('revision.curtain_on_sub')}</Text>
          </Animated.View>
        </View>
      </Animated.View>
    );
  }
  // Leaving: the scheme's own hero, so the fall-away reads as «back to the usual colours».
  const colors = gradientSets[scheme].auth;
  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { zIndex: 1000 }, veil]} accessibilityLiveRegion="polite">
      <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View style={[{ alignItems: 'center' }, mark]}>
          <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: REVISION_INK.amber, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Icon name="home" size={44} color="#FFFFFF" />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#FFFFFF', marginTop: 18 }}>{t('revision.curtain_off')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>{t('revision.curtain_off_sub')}</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}
