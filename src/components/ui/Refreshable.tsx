import { forwardRef, useCallback, useEffect, useMemo, useRef, type ComponentType, type ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList as RNFlatList,
  Platform,
  ScrollView as RNScrollView,
  SectionList as RNSectionList,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

type ScrollLikeProps = {
  refreshControl?: ReactElement<RefreshControlProps>;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
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

function FloatingRefresh({ Base, forwardedRef, refreshControl, onScroll, scrollEventThrottle, ...rest }: ScrollLikeProps & {
  Base: ComponentType<any>;
  forwardedRef: unknown;
}) {
  const insets = useSafeAreaInsets();
  const { refreshing = false, onRefresh, tintColor } = refreshControl!.props;

  const atTop = useSharedValue(true);
  const pull = useSharedValue(refreshing ? PULL_REST : 0);
  const busy = useSharedValue(refreshing);
  // The finger's travel at the moment the list reached the top, so a drag that scrolls up
  // to the top and keeps going starts the circle from zero instead of jumping.
  const startY = useSharedValue(0);
  const refreshingRef = useRef(refreshing);

  useEffect(() => {
    refreshingRef.current = refreshing;
    busy.value = refreshing;
    pull.value = refreshing ? withSpring(PULL_REST, { damping: 18, stiffness: 220 }) : withTiming(0, { duration: 220 });
  }, [refreshing, busy, pull]);

  const fire = useCallback(() => {
    onRefresh?.();
    // A screen whose refresh never flips `refreshing` must not leave the circle hanging.
    setTimeout(() => { if (!refreshingRef.current) pull.value = withTiming(0, { duration: 220 }); }, 900);
  }, [onRefresh, pull]);

  const native = useMemo(() => Gesture.Native(), []);
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .simultaneousWithExternalGesture(native)
    .onBegin(() => { startY.value = 0; })
    .onUpdate((e) => {
      if (busy.value) return;
      if (!atTop.value) { startY.value = e.translationY; return; }
      const d = e.translationY - startY.value;
      pull.value = d <= 0 ? 0 : Math.min(PULL_MAX, d * RESISTANCE);
    })
    .onEnd(() => {
      if (busy.value) return;
      if (pull.value >= PULL_TRIGGER) {
        pull.value = withSpring(PULL_REST, { damping: 18, stiffness: 220 });
        runOnJS(fire)();
      } else {
        pull.value = withTiming(0, { duration: 200 });
      }
    }), [native, busy, atTop, startY, pull, fire]);
  const gesture = useMemo(() => Gesture.Simultaneous(pan, native), [pan, native]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    atTop.value = e.nativeEvent.contentOffset.y <= 0.5;
    onScroll?.(e);
  }, [atTop, onScroll]);

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
      <GestureDetector gesture={gesture}>
        <Base
          ref={forwardedRef}
          {...rest}
          bounces={false}
          onScroll={handleScroll}
          scrollEventThrottle={scrollEventThrottle ?? 16}
        />
      </GestureDetector>
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
