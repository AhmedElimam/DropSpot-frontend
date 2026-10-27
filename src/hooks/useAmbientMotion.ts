import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { inTransition, subscribeTransitions } from '@/navigation/transitions';
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
 * Is this screen actually in front of someone — focused, with the app in the foreground, and
 * no screen sliding over or off it? For clocks, polls and ambient motion that only matter
 * while seen: hidden tabs stay mounted (the stacks do not freeze), and Android keeps JS
 * timers running in the background.
 *
 * Waits out a stack transition on purpose (src/navigation/transitions.ts): the screen under
 * a popped page used to wake up at the pop — motion, polls, a re-render — inside the back
 * animation. Computed from the events, not from `useIsFocused`, so the component re-renders
 * only when the ANSWER changes: once, after the page has landed.
 */
export function useOnScreen(): boolean {
  const navigation = useNavigation();
  const [on, setOn] = useState(() => isOnScreen(navigation));
  useEffect(() => {
    const recompute = () => setOn(isOnScreen(navigation));
    const offFocus = navigation.addListener('focus' as never, recompute);
    const offBlur = navigation.addListener('blur' as never, recompute);
    const app = AppState.addEventListener('change', recompute);
    const offTransition = subscribeTransitions(recompute);
    recompute();
    return () => { offFocus(); offBlur(); app.remove(); offTransition(); };
  }, [navigation]);
  return on;
}

function isOnScreen(navigation: { isFocused?: () => boolean }): boolean {
  const focused = typeof navigation.isFocused === 'function' ? navigation.isFocused() : true;
  return focused && AppState.currentState === 'active' && !inTransition();
}
