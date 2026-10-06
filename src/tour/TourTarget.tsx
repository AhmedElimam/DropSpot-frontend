import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTourStore } from './store';

/**
 * Marks something the tour can spotlight. Measures itself in window coordinates on layout and
 * whenever the tour asks (after it opens a screen), and forgets itself on unmount, so a tour
 * step aimed at a control that is not on screen is simply skipped.
 */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<View>(null);
  const register = useTourStore((s) => s.register);
  const unregister = useTourStore((s) => s.unregister);
  const tick = useTourStore((s) => s.measureTick);
  const active = useTourStore((s) => s.tour !== null);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) register(id, { x, y, width, height });
    });
  }, [id, register]);

  // Measure again when the tour asks — a beat later, so a screen it just opened has laid out.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
  }, [tick, active, measure]);

  useEffect(() => () => unregister(id), [id, unregister]);

  return (
    <View ref={ref} collapsable={false} onLayout={measure} style={style}>
      {children}
    </View>
  );
}
