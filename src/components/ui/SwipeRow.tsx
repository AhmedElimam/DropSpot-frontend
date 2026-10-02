import { useRef, type ReactNode } from 'react';
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
}

const PANEL_W = 96;

/**
 * A list row with ONE swipe action, revealed under the row's start edge (the right, in
 * this RTL app) as the row is dragged toward the end. Past the threshold the action
 * fires and the row springs back — "swipe to read", nothing else (founder 2026-10-02:
 * one side to swipe to read, no hide).
 *
 * Built on gesture-handler's ReanimatedSwipeable, which runs the drag on the UI thread
 * and negotiates with the list's vertical scroll natively — the two JS PanResponder
 * versions before it either lost the touch to the ScrollView or never reached their
 * threshold ("it doesn't swipe to read, it stays the same"). The root layout mounts the
 * GestureHandlerRootView this needs.
 */
export function SwipeRow({ action, children, style }: { action: SwipeAction; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<SwipeableMethods>(null);
  const fire = () => {
    action.onTrigger();
    ref.current?.close();
  };
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.4}
      rightThreshold={64}
      overshootRight={false}
      renderRightActions={(progress) => <Panel progress={progress} action={action} />}
      onSwipeableWillOpen={fire}
      containerStyle={style}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function Panel({ progress, action }: { progress: SharedValue<number>; action: SwipeAction }) {
  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.9, 1], 'clamp'),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1], 'clamp') }],
  }));
  return (
    <View style={{ width: PANEL_W, backgroundColor: action.color, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }}>
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, anim]}>
        <Icon name={action.icon} size={24} color="#fff" />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }} numberOfLines={1}>{action.label}</Text>
      </Animated.View>
    </View>
  );
}
