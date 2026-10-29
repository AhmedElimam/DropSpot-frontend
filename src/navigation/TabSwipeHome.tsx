import { useCallback, type ReactNode } from 'react';
import { BackHandler, I18nManager, Platform, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

/** The strip at the back edge where the swipe starts — the same width iOS gives a pushed page. */
export const EDGE = 24;
/** How far, or how fast, the swipe must go to take you home. */
export const COMMIT = 72;
export const COMMIT_VELOCITY = 650;
const CHIP = 40;

/** Did the release take you home? `travel` is the distance moved away from the edge (positive). */
export function swipeCommits(travel: number, velocity: number): boolean {
  'worklet';
  return travel >= COMMIT || (travel >= 24 && velocity >= COMMIT_VELOCITY);
}

/**
 * A tab that is not Home goes back to Home (founder 2026-10-29: «a user on sessions or
 * management — any tab opened straight from the navbar — on back swipe goes back to the
 * homepage»). A tab is not a pushed page, so it has no native swipe; this gives it one:
 *
 *  - iOS: a swipe from the back edge (the right edge in Arabic, like every pushed page) — a
 *    small home chip follows the finger and, past the line, Home opens. The gesture sits on the
 *    scene with a hit slop at the edge only, so every tap and vertical scroll below it is untouched.
 *  - Android: the system back (button or gesture) on a tab goes Home, not to the tab before.
 *
 * Home itself has neither (back on Home leaves the app as before). Transforms and opacity only.
 */
export function TabSwipeHome({ home, goHome, children }: { home: boolean; goHome: () => void; children: ReactNode }) {
  // Android: back on a tab = Home. Registered while focused; it runs before the navigator's.
  useFocusEffect(
    useCallback(() => {
      if (home || Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => { goHome(); return true; });
      return () => sub.remove();
    }, [home, goHome]),
  );

  const rtl = I18nManager.isRTL;
  const travel = useSharedValue(0);
  const y = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(!home && Platform.OS === 'ios')
    .hitSlop(rtl ? { right: 0, width: EDGE } : { left: 0, width: EDGE })
    // Only a swipe away from the edge, never a vertical scroll.
    .activeOffsetX(rtl ? -12 : 12)
    .failOffsetY([-18, 18])
    .onBegin((e) => { y.value = e.y; })
    .onUpdate((e) => { travel.value = Math.max(0, rtl ? -e.translationX : e.translationX); })
    .onEnd((e) => {
      const v = rtl ? -e.velocityX : e.velocityX;
      if (swipeCommits(travel.value, v)) runOnJS(goHome)();
      travel.value = withTiming(0, { duration: 180 });
    })
    .onFinalize(() => { if (travel.value !== 0) travel.value = withTiming(0, { duration: 180 }); });

  const chip = useAnimatedStyle(() => {
    const p = Math.min(1, travel.value / COMMIT);
    // In from behind the edge, a little bigger once it would commit.
    const x = -CHIP + Math.min(travel.value, COMMIT + 16) * 0.75;
    return {
      opacity: p,
      transform: [{ translateY: y.value - CHIP / 2 }, { translateX: rtl ? -x : x }, { scale: p >= 1 ? 1.08 : 0.85 + 0.15 * p }],
    };
  });

  if (home) return <>{children}</>;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[{
            // `start` = the back edge in both directions (the right edge in Arabic).
            position: 'absolute', top: 0, start: 0, width: CHIP, height: CHIP, borderRadius: CHIP / 2,
            backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadows.md,
          }, chip]}
        >
          <Icon name="home" size={20} color={colors.onPrimary} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
