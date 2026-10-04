import { forwardRef, useCallback, useEffect, useRef, type ComponentType, type ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList as RNFlatList,
  Platform,
  ScrollView as RNScrollView,
  SectionList as RNSectionList,
  View,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
} from 'react-native';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows } from '@/theme/index';

/** How far the finger must pull (after resistance) to refresh. */
export const PULL_TRIGGER = 72;
/** The furthest the circle travels while being pulled. */
const PULL_MAX = 110;
/** Where the circle rests below the top inset while the refresh runs. */
const PULL_REST = 56;
const RESISTANCE = 0.55;
const CIRCLE = 40;

type Touch = (e: GestureResponderEvent) => void;
type ScrollLikeProps = {
  refreshControl?: ReactElement<RefreshControlProps>;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onTouchStart?: Touch;
  onTouchMove?: Touch;
  onTouchEnd?: Touch;
  onTouchCancel?: Touch;
  scrollEventThrottle?: number;
  bounces?: boolean;
  [key: string]: unknown;
};

/**
 * Floating pull-to-refresh (founder 2026-10-04: «make it floating instead of pulling the
 * whole page, like Android»). Android's native control already floats a spinner over the
 * content, so there nothing changes. On iOS the native control drags the whole page down;
 * here the page stays put (no top bounce) and a round spinner slides down over it,
 * follows the finger, and spins in place while the refresh runs.
 *
 * Drop-in: screens keep passing `refreshControl={<RefreshControl refreshing onRefresh />}`
 * and only import ScrollView / FlatList / SectionList from here instead of react-native.
 * Without a refreshControl these are the plain React Native components.
 */
function withFloatingRefresh<C extends ComponentType<any>>(Base: C): C {
  const Wrapped = forwardRef<unknown, ScrollLikeProps>((props, ref) => {
    if (Platform.OS !== 'ios' || !props.refreshControl) {
      const B = Base as ComponentType<any>;
      return <B ref={ref} {...props} />;
    }
    return <FloatingRefresh Base={Base as ComponentType<any>} forwardedRef={ref} {...props} />;
  });
  Wrapped.displayName = `Refreshable(${(Base as { displayName?: string }).displayName ?? 'List'})`;
  return Wrapped as unknown as C;
}

function FloatingRefresh({ Base, forwardedRef, refreshControl, onScroll, scrollEventThrottle, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, ...rest }: ScrollLikeProps & {
  Base: ComponentType<any>;
  forwardedRef: unknown;
}) {
  const insets = useSafeAreaInsets();
  const { refreshing = false, onRefresh, tintColor } = refreshControl!.props;

  const pull = useSharedValue(refreshing ? PULL_REST : 0);
  const refreshingRef = useRef(refreshing);

  useEffect(() => {
    refreshingRef.current = refreshing;
    pull.value = refreshing ? withSpring(PULL_REST, { damping: 18, stiffness: 220 }) : withTiming(0, { duration: 220 });
  }, [refreshing, pull]);

  const fire = useCallback(() => {
    onRefresh?.();
    // A screen whose refresh never flips `refreshing` must not leave the circle hanging.
    setTimeout(() => { if (!refreshingRef.current) pull.value = withTiming(0, { duration: 220 }); }, 900);
  }, [onRefresh, pull]);

  // The pull is read from the scroll view's own touch events. They only OBSERVE: nothing
  // here claims a touch, so a tap on a card fires once and the system's edge swipe back
  // keeps working (a gesture-handler Pan around the list broke both, 2026-10-04).
  const touch = useRef<{ x: number; y: number; tracking: boolean; vertical: boolean | null }>({ x: 0, y: 0, tracking: false, vertical: null });
  const atTopRef = useRef(true);

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    touch.current = { x: pageX, y: pageY, tracking: atTopRef.current, vertical: null };
    onTouchStart?.(e);
  }, [onTouchStart]);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    onTouchMove?.(e);
    const t = touch.current;
    if (refreshingRef.current || e.nativeEvent.touches.length > 1) return;
    const { pageX, pageY } = e.nativeEvent;
    // A drag that scrolls the list up to the top and keeps going starts the pull there.
    if (!t.tracking) {
      if (atTopRef.current) { t.tracking = true; t.x = pageX; t.y = pageY; }
      return;
    }
    const dx = pageX - t.x;
    const dy = pageY - t.y;
    if (t.vertical === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) t.vertical = Math.abs(dy) > Math.abs(dx);
    if (t.vertical !== true) return; // a sideways swipe (a card's swipe action) is not a pull
    pull.value = dy <= 0 ? 0 : Math.min(PULL_MAX, dy * RESISTANCE);
  }, [onTouchMove, pull]);

  const release = useCallback(() => {
    const t = touch.current;
    t.tracking = false;
    if (refreshingRef.current) return;
    if (t.vertical === true && pull.value >= PULL_TRIGGER) {
      pull.value = withSpring(PULL_REST, { damping: 18, stiffness: 220 });
      fire();
    } else if (pull.value > 0) {
      pull.value = withTiming(0, { duration: 200 });
    }
  }, [fire, pull]);

  const handleTouchEnd = useCallback((e: GestureResponderEvent) => { onTouchEnd?.(e); release(); }, [onTouchEnd, release]);
  const handleTouchCancel = useCallback((e: GestureResponderEvent) => { onTouchCancel?.(e); release(); }, [onTouchCancel, release]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    atTopRef.current = e.nativeEvent.contentOffset.y <= 0.5;
    onScroll?.(e);
  }, [onScroll]);

  const circle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [0, 24], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: pull.value },
      { rotate: `${interpolate(pull.value, [0, PULL_TRIGGER], [0, 270], Extrapolation.CLAMP)}deg` },
      { scale: interpolate(pull.value, [0, PULL_TRIGGER], [0.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <>
      <Base
        ref={forwardedRef}
        {...rest}
        bounces={false}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      />
      {/* Floats over the content; never takes a touch. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top - CIRCLE, left: 0, right: 0, alignItems: 'center' }}>
        <Animated.View
          style={[{
            width: CIRCLE,
            height: CIRCLE,
            borderRadius: CIRCLE / 2,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadows.md,
          }, circle]}
        >
          <ActivityIndicator animating={refreshing} hidesWhenStopped={false} color={tintColor ?? colors.brand} />
        </Animated.View>
      </View>
    </>
  );
}

export const ScrollView = withFloatingRefresh(RNScrollView);
export const FlatList = withFloatingRefresh(RNFlatList) as typeof RNFlatList;
export const SectionList = withFloatingRefresh(RNSectionList) as typeof RNSectionList;
