import { useEffect, useRef, type ReactNode } from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { Icon, type IconName } from '@/components/ui/Icon';

export interface SwipeAction {
  icon: IconName;
  label: string;
  color: string;
  onTrigger: () => void;
  /**
   * Fire only once the row has sprung back. For an action that RESTYLES the row itself
   * (read ⇄ unread): firing mid-motion restyled the row and the panel while they slid.
   * Off by default: an action that opens something (a sheet, a confirmation) fires at the
   * threshold, so it appears at once (founder 2026-10-11: «a delay until the modal shows»).
   */
  afterSettle?: boolean;
}

const PANEL_W = 96;

/**
 * The strip along each side of the screen where iOS starts the back gesture. In RTL the
 * back swipe starts at the RIGHT edge and moves left — the same motion that opens a row's
 * action — so a row that also answered there moved one way while the page went back the
 * other ("it glitches on directions on back motion", founder 2026-10-04). A drag that starts
 * in this strip belongs to the page; rows only answer inside it.
 */
const EDGE_GUARD = 28;

/**
 * A list row with a swipe action revealed under the right edge as the row is dragged
 * left, and optionally a second one under the left edge as it is dragged right. Past the threshold the action
 * fires and the row springs back — "swipe to read", nothing else (founder 2026-10-02:
 * one side to swipe to read, no hide).
 *
 * Built on gesture-handler's ReanimatedSwipeable, which runs the drag on the UI thread
 * and negotiates with the list's vertical scroll natively — the two JS PanResponder
 * versions before it either lost the touch to the ScrollView or never reached their
 * threshold ("it doesn't swipe to read, it stays the same"). The root layout mounts the
 * GestureHandlerRootView this needs.
 */
export function SwipeRow({ action, leftAction, children, style, radius = 20, peek = false, onPeeked }: {
  /** Revealed on the RIGHT edge by a swipe from right to left. */
  action?: SwipeAction;
  /** Revealed on the LEFT edge by a swipe from left to right (founder 2026-10-04: a second
   *  action on the teacher's home session cards). Optional — most rows have one action. */
  leftAction?: SwipeAction;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** The row's own corner radius: the panel's OUTER corners take it, so the green or red
   *  block reads as part of the card, not a tile beside it (founder 2026-10-11). */
  radius?: number;
  /** Slide the left action open by itself once and back — teaches that the card swipes
   *  (founder 2026-10-25). Nothing fires during the peek. */
  peek?: boolean;
  onPeeked?: () => void;
}) {
  const ref = useRef<SwipeableMethods>(null);
  const peeking = useRef(false);
  const hasLeft = !!leftAction;
  useEffect(() => {
    if (!peek || !hasLeft) return;
    let back: ReturnType<typeof setTimeout> | undefined;
    const go = setTimeout(() => {
      peeking.current = true;
      ref.current?.openLeft();
      back = setTimeout(() => ref.current?.close(), 1100);
    }, 900);
    // Interrupted mid-peek (a popup, the screen left): close it rather than leave it open.
    return () => { clearTimeout(go); if (back) clearTimeout(back); if (peeking.current) ref.current?.close(); };
  }, [peek, hasLeft]);
  // The library reports PHYSICAL directions, never flipped for RTL: 'left' = the row moved
  // left (finger right → left, the right panel shows); 'right' = the opposite.
  // An action that restyles the row (afterSettle) is remembered at the threshold and fired
  // once the row has sprung back (onSwipeableClose); every other action fires at once.
  const pending = useRef<SwipeAction | null>(null);
  const arm = (direction: 'left' | 'right') => {
    if (peeking.current) return;
    const a = (direction === 'left' ? action : leftAction) ?? null;
    ref.current?.close();
    if (a?.afterSettle) { pending.current = a; return; }
    a?.onTrigger();
  };
  const settled = () => {
    if (peeking.current) { peeking.current = false; onPeeked?.(); return; }
    const a = pending.current;
    pending.current = null;
    a?.onTrigger();
  };
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.4}
      rightThreshold={64}
      leftThreshold={64}
      overshootRight={false}
      overshootLeft={false}
      hitSlop={{ left: -EDGE_GUARD, right: -EDGE_GUARD }}
      // A deliberate sideways drag, not the first few points of a back swipe or a scroll.
      dragOffsetFromLeftEdge={16}
      dragOffsetFromRightEdge={16}
      renderRightActions={action ? (progress) => <Panel progress={progress} action={action} radius={radius} edge="right" /> : undefined}
      renderLeftActions={leftAction ? (progress) => <Panel progress={progress} action={leftAction} radius={radius} edge="left" /> : undefined}
      onSwipeableWillOpen={(d) => arm(d === 'left' ? 'left' : 'right')}
      onSwipeableClose={settled}
      containerStyle={style}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function Panel({ progress, action, radius, edge }: { progress: SharedValue<number>; action: SwipeAction; radius: number; edge: 'left' | 'right' }) {
  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.9, 1], 'clamp'),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1], 'clamp') }],
  }));
  // Only the corners on the screen's edge are rounded; the inner edge meets the sliding
  // card flush, so no sliver of background shows between them.
  const corners = edge === 'right'
    ? { borderTopRightRadius: radius, borderBottomRightRadius: radius }
    : { borderTopLeftRadius: radius, borderBottomLeftRadius: radius };
  return (
    <View style={{ width: PANEL_W, backgroundColor: action.color, alignItems: 'center', justifyContent: 'center', ...corners }}>
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, anim]}>
        <Icon name={action.icon} size={24} color="#fff" />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }} numberOfLines={1}>{action.label}</Text>
      </Animated.View>
    </View>
  );
}
