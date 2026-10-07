import { useCallback, useEffect } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { InlineSheetHost } from '@/components/ui/SheetModal';
import { colors, radius } from '@/theme/index';
import { StudentProfile } from '@/components/teacher/StudentProfile';

/**
 * The student's full profile as a sheet over the collections list (founder 2026-10-06: the RN
 * modal opened and closed clumsily). Same component as the page, so nothing differs but the frame.
 *
 * iOS: the stack presents a native page sheet — spring, grabber, swipe down, the list dimmed
 * above. Its own SafeAreaProvider measures the sheet, not the window: no status-bar gap in a
 * card that starts below the status bar.
 *
 * Android has no native page sheet (founder 2026-10-07: the full-screen stand-in sat under the
 * notch and the grabber did nothing). The screen is transparent and draws the sheet itself:
 * below the status bar, sliding up, closed by dragging the hero down, tapping above it, or back.
 */
export default function StudentSheet() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return Platform.OS === 'android' ? <AndroidSheet id={id} name={name} /> : (
    // The profile's own sheets (collect, correct, past attendance, paid before joining…) draw
    // inside this page sheet, not as a second native modal iOS may refuse to present.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <InlineSheetHost>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StudentProfile id={id} sheet initialName={name} onClose={() => (router.canGoBack() ? router.back() : undefined)} />
          </View>
        </InlineSheetHost>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const OPEN = { damping: 24, stiffness: 220, mass: 0.9 };
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;
/** Room left above the sheet, under the status bar, so the list behind shows it is a sheet. */
const PEEK = 10;

function AndroidSheet({ id, name }: { id: string; name?: string }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const y = useSharedValue(height);
  const dim = useSharedValue(0);

  useEffect(() => {
    y.value = withSpring(0, OPEN);
    dim.value = withTiming(1, { duration: 220 });
    // Opening only; the height is the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = useCallback(() => { if (router.canGoBack()) router.back(); }, []);
  const close = useCallback(() => {
    y.value = withTiming(height, { duration: 200 });
    dim.value = withTiming(0, { duration: 200 }, (done) => { if (done) runOnJS(leave)(); });
  }, [y, dim, height, leave]);

  // Back slides the sheet down instead of cutting it away.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  }, [close]);

  // Only a clear downward drag on the hero takes the sheet; taps on its buttons stay taps.
  const drag = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-10)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
      dim.value = Math.max(0, 1 - e.translationY / (height * 0.7));
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        y.value = withTiming(height, { duration: 180 });
        dim.value = withTiming(0, { duration: 180 }, (done) => { if (done) runOnJS(leave)(); });
      } else {
        y.value = withSpring(0, OPEN);
        dim.value = withTiming(1, { duration: 150 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, dimStyle]} />
      <Pressable style={{ height: insets.top + PEEK }} onPress={close} accessibilityRole="button" accessibilityLabel="إغلاق" />
      <Animated.View style={[{ flex: 1, backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' }, sheetStyle]}>
        <InlineSheetHost>
          <StudentProfile id={id} sheet initialName={name} onClose={close} heroGesture={drag} />
        </InlineSheetHost>
      </Animated.View>
    </GestureHandlerRootView>
  );
}
