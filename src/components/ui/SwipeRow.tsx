import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, View, Text, TouchableOpacity, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { fonts } from '@/theme/typography';
import { Icon, type IconName } from '@/components/ui/Icon';

export interface SwipeAction {
  icon: IconName;
  label: string;
  color: string;
  onTrigger: () => void;
}

const BUTTON_W = 78;
const OPEN_AT = 36;       // a short swipe past this opens the buttons
const FULL_RATIO = 0.5;   // past half the row, the primary action fires on release

/**
 * A list row that swipes — the SAME in both directions, on purpose. A short swipe either
 * way slides the row aside and shows its buttons (tap one); a long swipe either way fires
 * the primary action (the first button) straight away.
 *
 * The first version had one action per direction, and «مقروء» was the leftward swipe —
 * which in this RTL app starts near the right edge, inside Android's back-gesture zone,
 * so the system took it and the read swipe "didn't work" (founder 2026-10-02) while the
 * other direction did. Both directions doing the same thing cannot lose half the feature,
 * and the buttons are a visible fallback for a swipe that came up short.
 *
 * RN's own PanResponder + Animated (native driver): no GestureHandlerRootView is mounted.
 * Positions are physical (left / right, translateX) — RN never mirrors those under RTL.
 * A horizontal intent is claimed only once the finger clearly moves sideways, so the
 * list's vertical scroll is untouched. Screen readers get the buttons as actions.
 */
export const SwipeRow = memo(function SwipeRow({
  actions, children, style,
}: { actions: SwipeAction[]; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const x = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);           // where the row rests: 0, or ± the buttons' width
  const width = useRef(360);
  const acts = useRef(actions);
  acts.current = actions;
  const panelW = BUTTON_W * actions.length;
  const panelRef = useRef(panelW);
  panelRef.current = panelW;
  const [open, setOpen] = useState(false);

  const settle = (to: number) => {
    offset.current = to;
    setOpen(to !== 0);
    Animated.spring(x, { toValue: to, useNativeDriver: true, bounciness: 4, speed: 20 }).start();
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;
  useEffect(() => () => x.stopAnimation(), [x]);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { x.stopAnimation(); },
    onPanResponderMove: (_e, g) => {
      const w = width.current;
      x.setValue(Math.max(-w, Math.min(w, offset.current + g.dx)));
    },
    onPanResponderRelease: (_e, g) => {
      const pos = offset.current + g.dx;
      const full = Math.abs(pos) >= width.current * FULL_RATIO || (Math.abs(g.vx) > 1.4 && Math.abs(pos) > panelRef.current);
      if (full && acts.current[0]) {
        acts.current[0].onTrigger();
        settleRef.current(0);
      } else if (Math.abs(pos) >= OPEN_AT) {
        settleRef.current(pos < 0 ? -panelRef.current : panelRef.current);
      } else {
        settleRef.current(0);
      }
    },
    onPanResponderTerminate: () => settleRef.current(0),
  })).current;

  // The panel on the side the row moved away from.
  const rightOpacity = x.interpolate({ inputRange: [-24, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const leftOpacity = x.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp' });
  // Past half the row the first button swells: "let go and it happens".
  const swell = x.interpolate({
    inputRange: [-500, -180, 0, 180, 500], outputRange: [1.15, 1, 1, 1, 1.15], extrapolate: 'clamp',
  });

  const fire = (a: SwipeAction) => { a.onTrigger(); settle(0); };

  const panel = (side: 'left' | 'right', opacity: Animated.AnimatedInterpolation<number>) => (
    <Animated.View pointerEvents={open ? 'box-none' : 'none'}
      style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: panelW, flexDirection: 'row', opacity }}>
      {actions.map((a, i) => (
        <TouchableOpacity key={a.label} onPress={() => fire(a)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={a.label}
          style={{ flex: 1, backgroundColor: a.color, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Animated.View style={{ alignItems: 'center', gap: 4, transform: [{ scale: i === 0 ? swell : 1 }] }}>
            <Icon name={a.icon} size={22} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }} numberOfLines={1}>{a.label}</Text>
          </Animated.View>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );

  return (
    <View
      style={[{ overflow: 'hidden' }, style]}
      onLayout={(e: LayoutChangeEvent) => { width.current = e.nativeEvent.layout.width; }}
      accessibilityActions={actions.map((a, i) => ({ name: `a${i}`, label: a.label }))}
      onAccessibilityAction={(e) => actions[Number(e.nativeEvent.actionName.slice(1))]?.onTrigger()}
    >
      {panel('right', rightOpacity)}
      {panel('left', leftOpacity)}
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>
        {children}
        {/* While open, a tap on the row closes it instead of opening the notification. */}
        {open ? <TouchableOpacity activeOpacity={1} onPress={() => settle(0)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} /> : null}
      </Animated.View>
    </View>
  );
});
