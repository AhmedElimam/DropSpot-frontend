import { useEffect, useState } from 'react';
import { useNavigation } from 'expo-router';

/**
 * True once this screen has finished sliding in. The push animation only starts after the
 * new screen's first render, so a heavy first render is a slow tap (founder 2026-10-08: «a
 * bit slow from the homepage to her tab» on mid-range phones). Render the light shell first
 * and the heavy parts once this flips.
 *
 * `transitionEnd` is the native stack's own signal; the timer is the floor for a screen with
 * no animation (a deep link, the first screen) or a navigator that never sends it.
 */
export function useArrived(fallbackMs = 650): boolean {
  const navigation = useNavigation();
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (arrived) return;
    const done = () => setArrived(true);
    const off = navigation.addListener('transitionEnd' as never, done);
    const t = setTimeout(done, fallbackMs);
    return () => { off(); clearTimeout(t); };
  }, [navigation, arrived, fallbackMs]);
  return arrived;
}
