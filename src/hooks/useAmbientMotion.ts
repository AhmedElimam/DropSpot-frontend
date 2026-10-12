import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * May an ambient animation run right now? Only while its screen is in front, the app itself is
 * in front, and the phone has not asked for less motion (founder 2026-10-09: «we want this app
 * to be so light on all devices»). On Android a backgrounded app's screen still counts as
 * focused and JS timers keep firing, so focus alone is not enough. `extraHold` lets a caller
 * pause too (the page is scrolling, the picture is off-screen).
 */
export function useAmbientMotion(extraHold = false): boolean {
  const onScreen = useOnScreen();
  const still = useReducedMotion();
  return onScreen && !still && !extraHold;
}

/**
 * Is this screen actually in front of someone — focused, with the app in the foreground? For
 * clocks and polls that only matter while seen: hidden tabs stay mounted (the stacks do not
 * freeze), and Android keeps JS timers running in the background.
 */
export function useOnScreen(): boolean {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && active;
}
