import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, KeyboardAvoidingView, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme/index';

interface SheetModalProps {
  visible: boolean;
  /** Called when the person dismisses the sheet: a tap on the dim, a swipe down, or the hardware back. */
  onClose: () => void;
  children: ReactNode;
  /** Wrap the sheet in a keyboard avoider (sheets with text fields). */
  avoidKeyboard?: boolean;
  /** Extra style on the sheet card (background, padding). Defaults to the canvas with the usual rounding. */
  style?: StyleProp<ViewStyle>;
  /** Hide the grab handle (a sheet that draws its own header). */
  handle?: boolean;
  /** Dim colour behind the sheet. */
  backdropColor?: string;
}

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 900;
const OPEN_SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

/**
 * The app's bottom sheet: dim behind, card at the bottom, and — the part the plain RN
 * Modal never had (founder 2026-10-03: «swipe down on modal to dismiss») — drag the sheet
 * down to close it, following the finger, with a flick or a long enough pull letting go.
 * A tap on the dim and the hardware back close it too. One component, so every sheet
 * behaves the same; the content inside is untouched (its own ScrollView keeps scrolling —
 * the drag is recognised only when it starts moving DOWN past a small threshold).
 *
 * The RN Modal underneath is kept for what it does well: a native window above tabs and
 * headers, hardware back on Android. Its own slide animation is off; the sheet animates
 * itself so the drag and the dismissal share one position.
 */
export function SheetModal({ visible, onClose, children, avoidKeyboard = false, style, handle = true, backdropColor = colors.overlay }: SheetModalProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Rendered while the close animation runs, then unmounted.
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(height);
  const dim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withSpring(0, OPEN_SPRING);
      dim.value = withTiming(1, { duration: 220 });
    } else if (mounted) {
      translateY.value = withTiming(height, { duration: 200 });
      dim.value = withTiming(0, { duration: 200 }, (done) => { if (done) runOnJS(setMounted)(false); });
    }
    // `mounted` is state this effect drives; `height` only matters while opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => onClose();

  const pan = Gesture.Pan()
    // Only a clear downward drag takes the sheet; horizontal or upward movement is left to
    // whatever is inside (a horizontal chip row, a scroll view).
    .activeOffsetY(12)
    .failOffsetY(-12)
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
      dim.value = Math.max(0, 1 - e.translationY / (height * 0.6));
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        translateY.value = withTiming(height, { duration: 180 });
        dim.value = withTiming(0, { duration: 180 }, (done) => { if (done) runOnJS(close)(); });
      } else {
        translateY.value = withSpring(0, OPEN_SPRING);
        dim.value = withTiming(1, { duration: 150 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  if (!mounted) return null;

  const body = (
    <>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: backdropColor }, dimStyle]} />
      <Pressable style={{ flex: 1 }} onPress={close} accessibilityRole="button" accessibilityLabel="إغلاق" />
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              maxHeight: height - insets.top - spacing.xl,
            },
            style,
            sheetStyle,
          ]}
        >
          {handle ? <Animated.View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md }} /> : null}
          {children}
        </Animated.View>
      </GestureDetector>
    </>
  );

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      {/* `padding` on BOTH platforms: SDK 54 Android is edge-to-edge, so the old "resize"
          path no longer shrinks the window and the keyboard would cover the sheet's fields. */}
      {avoidKeyboard ? (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        <Animated.View style={{ flex: 1, justifyContent: 'flex-end' }}>{body}</Animated.View>
      )}
    </Modal>
  );
}
