import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, Keyboard, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions, type KeyboardEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme/index';

interface SheetModalProps {
  visible: boolean;
  /** Called when the person dismisses the sheet: a tap on the dim, a swipe down, or the hardware back. */
  onClose: () => void;
  children: ReactNode;
  /** The sheet has text fields: keep them above the keyboard (lift, shrink, scroll the field into view). */
  avoidKeyboard?: boolean;
  /** Extra style on the sheet card (background, padding). Defaults to the canvas with the usual rounding. */
  style?: StyleProp<ViewStyle>;
  /** Hide the grab handle (a sheet that draws its own header). */
  handle?: boolean;
  /** Dim colour behind the sheet. */
  backdropColor?: string;
}

/**
 * Inside a screen that is itself a native modal (the student profile opened as a page sheet
 * over the collections list), a sheet must not be a second RN Modal: iOS may refuse to present
 * it from a controller that is already presented, and the button that opens it then does
 * nothing (founder 2026-10-06: «past sessions / paid before joining — the button is clickable
 * but nothing shows»). Wrap such a screen in <InlineSheetHost>; its sheets draw as an overlay
 * inside the screen instead — same look, same drag, same keyboard handling.
 */
const InlineSheets = createContext(false);
export function InlineSheetHost({ children }: { children: ReactNode }) {
  return <InlineSheets.Provider value>{children}</InlineSheets.Provider>;
}

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 900;
const OPEN_SPRING = { damping: 26, stiffness: 260, mass: 0.9 };
/** Space kept between the focused field and the top of the keyboard / sheet edge. */
const FIELD_MARGIN = 24;

/**
 * How far to lift the sheet for a keyboard that covers `overlap` points of the screen. If the
 * system already shrank the window (an Android window in resize mode), only the part it did not
 * absorb is ours to add — otherwise the sheet would be lifted twice. Pure, so it is testable.
 */
export function keyboardLift(overlap: number, baseHeight: number, currentHeight: number): number {
  const absorbed = Math.max(0, baseHeight - currentHeight);
  return Math.max(0, Math.round(overlap - absorbed));
}

/**
 * The app's bottom sheet: dim behind, card at the bottom, and — the part the plain RN
 * Modal never had (founder 2026-10-03: «swipe down on modal to dismiss») — drag the sheet
 * down to close it, following the finger, with a flick or a long enough pull letting go.
 * A tap on the dim and the hardware back close it too. One component, so every sheet
 * behaves the same; the content inside is untouched (its own ScrollView keeps scrolling —
 * the drag is recognised only when it starts moving DOWN past a small threshold).
 *
 * The keyboard (founder 2026-10-06: «the keyboard overlays the modal», student complaint
 * sheets and the teacher's quick check-in mark). KeyboardAvoidingView inside a Modal window
 * was unreliable — on edge-to-edge Android it often added nothing — and a tall sheet had no
 * way to scroll its field into view. A sheet with `avoidKeyboard` now reads the keyboard
 * itself: it lifts by exactly the part of the screen the keyboard covers, shrinks to the room
 * that is left, scrolls, and brings the field being typed in into view.
 *
 * The RN Modal underneath is kept for what it does well: a native window above tabs and
 * headers, hardware back on Android. Its own slide animation is off; the sheet animates
 * itself so the drag and the dismissal share one position.
 */
export function SheetModal({ visible, onClose, children, avoidKeyboard = false, style, handle = true, backdropColor = colors.overlay }: SheetModalProps) {
  const insets = useSafeAreaInsets();
  const inline = useContext(InlineSheets);
  const { height } = useWindowDimensions();
  // Rendered while the close animation runs, then unmounted.
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(height);
  const dim = useSharedValue(0);

  // ── keyboard ──
  const lift = useSharedValue(0);
  const [lifted, setLifted] = useState(0);
  const [boxHeight, setBoxHeight] = useState(height);
  const baseHeight = useRef(height);
  const overlapRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);

  const onBoxLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setBoxHeight(h);
    if (overlapRef.current === 0) {
      baseHeight.current = h;
      return;
    }
    // The window shrank AFTER the keyboard event (Android resize): take back what it absorbed.
    const by = keyboardLift(overlapRef.current, baseHeight.current, h);
    lift.value = withTiming(by, { duration: 120 });
    setLifted(by);
  };

  useEffect(() => {
    if (!avoidKeyboard || !mounted) return;
    const ios = Platform.OS === 'ios';
    const reveal = () => {
      // Bring the field being typed in into view inside the (now shorter) sheet.
      const field = TextInput.State.currentlyFocusedInput?.() as unknown as { measureLayout?: Function } | null;
      const content = contentRef.current as unknown as number | null;
      if (!field?.measureLayout || !content) return;
      try {
        field.measureLayout(content, (_x: number, y: number) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - FIELD_MARGIN), animated: true });
        }, () => {});
      } catch {
        // A field that cannot be measured stays where it is; the sheet is still lifted.
      }
    };
    const onShow = (e: KeyboardEvent) => {
      const overlap = e.endCoordinates.height;
      overlapRef.current = overlap;
      const by = keyboardLift(overlap, baseHeight.current, boxHeight);
      const duration = e.duration && e.duration > 0 ? e.duration : 220;
      lift.value = withTiming(by, { duration });
      setLifted(by);
      setTimeout(reveal, duration + 30);
    };
    const onHide = (e: KeyboardEvent) => {
      overlapRef.current = 0;
      lift.value = withTiming(0, { duration: e?.duration && e.duration > 0 ? e.duration : 200 });
      setLifted(0);
    };
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    return () => { show.remove(); hide.remove(); };
    // boxHeight is read at the moment the keyboard opens; re-subscribing on it is harmless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avoidKeyboard, mounted, boxHeight]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withSpring(0, OPEN_SPRING);
      dim.value = withTiming(1, { duration: 220 });
    } else if (mounted) {
      Keyboard.dismiss();
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
  const boxStyle = useAnimatedStyle(() => ({ paddingBottom: lift.value }));

  if (!mounted) return null;

  // With the keyboard up the home indicator is behind it, and the sheet may only take the room
  // left above the keyboard.
  const keyboardUp = lifted > 0;
  const room = boxHeight - lifted - insets.top - (keyboardUp ? spacing.md : spacing.xl);

  return (
    <Host inline={inline} onRequestClose={close}>
      <Animated.View onLayout={avoidKeyboard ? onBoxLayout : undefined} style={[{ flex: 1, justifyContent: 'flex-end' }, avoidKeyboard ? boxStyle : null]}>
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
                paddingBottom: keyboardUp ? spacing.md : insets.bottom + spacing.lg,
                maxHeight: Math.max(160, avoidKeyboard ? room : height - insets.top - spacing.xl),
              },
              style,
              keyboardUp ? { paddingBottom: spacing.md } : null,
              sheetStyle,
            ]}
          >
            {handle ? <Animated.View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md }} /> : null}
            {avoidKeyboard ? (
              <ScrollView
                ref={scrollRef}
                style={{ flexGrow: 0 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled
              >
                <View ref={contentRef} collapsable={false}>{children}</View>
              </ScrollView>
            ) : children}
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </Host>
  );
}

/** A real Modal normally; an overlay over the current screen inside an InlineSheetHost. */
function Host({ inline, onRequestClose, children }: { inline: boolean; onRequestClose: () => void; children: ReactNode }) {
  if (inline) return <View style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}>{children}</View>;
  // A Modal is its own native window on Android: gestures inside it need their own root, or
  // the swipe down never fires there (founder 2026-10-07: «swipe dismiss doesn't work on
  // android»). iOS shares the root, and a nested one is harmless.
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onRequestClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
    </Modal>
  );
}
