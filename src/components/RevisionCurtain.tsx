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

/**
 * The crossing into (or out of) «وضع المراجعة»: a full-screen curtain in the colour of the
 * side being entered rises over the app, the tokens flip and the tree is rebuilt under it,
 * and it falls away over the new colours — a crossfade instead of a hard cut (founder
 * 2026-10-16: «a smooth crossfade when the switch flips»). Lives OUTSIDE the re-keyed tree
 * so the rebuild never unmounts it. Opacity and a small scale only, on the UI thread.
 */
const HOLD_MS = 520;
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
  useEffect(() => {
    const done = () => useThemeStore.getState().curtainDone();
    o.value = withSequence(
      withTiming(1, { duration: CURTAIN_IN_MS, easing: Easing.out(Easing.quad) }),
      withDelay(HOLD_MS, withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => { if (finished) runOnJS(done)(); })),
    );
    s.value = withTiming(1, { duration: CURTAIN_IN_MS + HOLD_MS, easing: Easing.out(Easing.cubic) });
  }, [o, s]);
  const veil = useAnimatedStyle(() => ({ opacity: o.value }));
  const mark = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  // Entering: the season's indigo. Leaving: the scheme's own hero, so the fall-away reads
  // as «back to the usual colours».
  const colors = to
    ? [REVISION_INK.indigo, REVISION_INK.indigoDeep, REVISION_INK.indigoDeeper] as const
    : gradientSets[scheme].auth;
  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { zIndex: 1000 }, veil]} accessibilityLiveRegion="polite">
      <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View style={[{ alignItems: 'center' }, mark]}>
          <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: REVISION_INK.amber, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Icon name={to ? 'book' : 'home'} size={44} color="#FFFFFF" />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#FFFFFF', marginTop: 18 }}>{t(to ? 'revision.curtain_on' : 'revision.curtain_off')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>{t(to ? 'revision.curtain_on_sub' : 'revision.curtain_off_sub')}</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}
