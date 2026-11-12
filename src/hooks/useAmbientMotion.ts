import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { inTransition, onScreenAnswer, subscribeTransitions } from '@/navigation/transitions';
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
 * clocks, polls and ambient motion that only matter while seen: hidden tabs stay mounted (the
 * stacks do not freeze), and Android keeps JS timers running in the background.
 *
 * The answer never changes while a screen slides (src/navigation/transitions.ts): whatever
 * happens during a transition — the page under a pop gaining focus, the page under a push
 * losing it — is read once the page has landed. So this hook re-renders nothing inside an
 * animation, in either direction.
 *
 * It used to answer false for the whole transition, which re-rendered every component reading
 * it at the START of each slide: the page being left on a swipe back, the home under a push
 * (founder 2026-11-12: «the stall on an aggressive swipe back keeps happening, and sometimes
 * on getting into a page»). Polls and clocks live in screen-level hooks, so that was the whole
 * screen, rendered in the first frames of the gesture.
 *
 * Computed from the events, not from `useIsFocused`, so the component re-renders only when
 * the ANSWER changes.
 */
export function useOnScreen(): boolean {
  const navigation = useNavigation();
  // A screen that mounts while it slides in starts off: its clocks and polls begin on landing.
  const [on, setOn] = useState(() => isInFront(navigation) && !inTransition());
  useEffect(() => {
    const recompute = () => setOn((prev) => onScreenAnswer(prev, isInFront(navigation)));
    const offFocus = navigation.addListener('focus' as never, recompute);
    const offBlur = navigation.addListener('blur' as never, recompute);
    const app = AppState.addEventListener('change', recompute);
    // Told at the start (kept: a transition is running) and at the end (read then).
    const offTransition = subscribeTransitions(recompute);
    recompute();
    return () => { offFocus(); offBlur(); app.remove(); offTransition(); };
  }, [navigation]);
  return on;
}

function isInFront(navigation: { isFocused?: () => boolean }): boolean {
  const focused = typeof navigation.isFocused === 'function' ? navigation.isFocused() : true;
  return focused && AppState.currentState === 'active';
}
