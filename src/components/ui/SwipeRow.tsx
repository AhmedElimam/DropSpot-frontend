import { memo, useEffect, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, View, Text, I18nManager, Dimensions, type StyleProp, type ViewStyle } from 'react-native';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

export interface SwipeAction {
  icon: IconName;
  label: string;
  color: string;
  onTrigger: () => void;
  /** Slide the row off-screen before firing (the row is leaving the list). */
  removes?: boolean;
}

const THRESHOLD = 84;

/**
 * A list row that swipes. `start` is revealed on the START edge (the right, in this RTL
 * app) when the row is pulled toward the end — finger moves left; `end` is the opposite.
 * Past the threshold on release the action fires; short of it the row springs back.
 *
 * Built on RN's own PanResponder + Animated (native driver), not gesture-handler's
 * Swipeable: that one needs a GestureHandlerRootView this app does not mount, and it lays
 * its actions out with physical rows that mirror wrongly under forced RTL. A horizontal
 * intent is claimed only once the finger has clearly moved sideways, so vertical scrolling
 * of the list is untouched. Screen readers get the same two actions as accessibility
 * actions.
 */
export const SwipeRow = memo(function SwipeRow({
  start, end, children, style,
}: { start?: SwipeAction; end?: SwipeAction; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const x = useRef(new Animated.Value(0)).current;
  // The responder is created once; the actions change with the row (read ↔ unread).
  const actions = useRef({ start, end });
  actions.current = { start, end };
  // Physical dx of "toward the end edge": left in RTL.
  const towardEndSign = I18nManager.isRTL ? -1 : 1;
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const springBack = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 18 }).start();

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_e, g) => {
      const toEnd = g.dx * towardEndSign > 0;
      const action = toEnd ? actions.current.start : actions.current.end;
      // No action that way → a little resistance, nothing more.
      x.setValue(action ? g.dx : g.dx * 0.15);
    },
    onPanResponderRelease: (_e, g) => {
      const toEnd = g.dx * towardEndSign > 0;
      const action = toEnd ? actions.current.start : actions.current.end;
      const far = Math.abs(g.dx) >= THRESHOLD || (Math.abs(g.vx) > 0.9 && Math.abs(g.dx) > 40);
      if (!action || !far) { springBack(); return; }
      if (action.removes) {
        const w = Dimensions.get('window').width;
        Animated.timing(x, { toValue: Math.sign(g.dx) * w, duration: 170, useNativeDriver: true }).start(() => {
          action.onTrigger();
          // Normally the row unmounts now. If it is still here (the server said no and the
          // list rolled back) it comes back into view instead of staying off-screen.
          resetTimer.current = setTimeout(() => x.setValue(0), 700);
        });
      } else {
        action.onTrigger();
        springBack();
      }
    },
    onPanResponderTerminate: () => springBack(),
  })).current;

  // Which layer shows depends on the direction of travel.
  const startOpacity = x.interpolate({
    inputRange: towardEndSign > 0 ? [0, 24] : [-24, 0],
    outputRange: towardEndSign > 0 ? [0, 1] : [1, 0],
    extrapolate: 'clamp',
  });
  const endOpacity = x.interpolate({
    inputRange: towardEndSign > 0 ? [-24, 0] : [0, 24],
    outputRange: towardEndSign > 0 ? [1, 0] : [0, 1],
    extrapolate: 'clamp',
  });
  const iconScale = x.interpolate({
    inputRange: [-THRESHOLD, -THRESHOLD + 1, 0, THRESHOLD - 1, THRESHOLD],
    outputRange: [1.2, 1, 1, 1, 1.2],
    extrapolate: 'clamp',
  });

  const layer = (a: SwipeAction, opacity: Animated.AnimatedInterpolation<number>, edge: 'flex-start' | 'flex-end') => (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity, backgroundColor: a.color, flexDirection: 'row', alignItems: 'center', justifyContent: edge, paddingHorizontal: spacing.xl }}>
      <Animated.View style={{ alignItems: 'center', gap: 4, transform: [{ scale: iconScale }] }}>
        <Icon name={a.icon} size={24} color="#fff" />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{a.label}</Text>
      </Animated.View>
    </Animated.View>
  );

  const a11y = [start, end].filter(Boolean).map((a, i) => ({ name: i === 0 && start ? 'start' : 'end', label: a!.label }));

  return (
    <View
      style={[{ overflow: 'hidden' }, style]}
      accessibilityActions={a11y}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'start' ? start : end)?.onTrigger()}
    >
      {start ? layer(start, startOpacity, 'flex-start') : null}
      {end ? layer(end, endOpacity, 'flex-end') : null}
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>
        {children}
      </Animated.View>
    </View>
  );
});
