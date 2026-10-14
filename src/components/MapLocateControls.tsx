import { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated, Easing } from 'react-native';
import { colors, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

/**
 * The two round buttons on every map (founder 2026-10-14: «on the locator, above it the icon of
 * live tracking, and change the locator icon»): on top, live tracking — the waves of the live
 * location, lit while the map follows the phone (a drag stops it); under it the locator, a
 * crosshair, that brings the map back to where you are once.
 */
export function MapLocateControls({ hasFix, following, onFollow, onLocate }: {
  hasFix: boolean; following: boolean; onFollow: () => void; onLocate: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!following) { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [following, pulse]);
  const btn = { width: 46, height: 46, borderRadius: 23, alignItems: 'center' as const, justifyContent: 'center' as const, ...shadows.md };

  return (
    <View style={{ gap: 10, alignItems: 'center' }}>
      <View style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
        {following ? (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: colors.success,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] }} />
        ) : null}
        <TouchableOpacity onPress={onFollow} disabled={!hasFix} accessibilityRole="switch" accessibilityState={{ checked: following }} accessibilityLabel="تتبّع مباشر" activeOpacity={0.85}
          style={[btn, { backgroundColor: following ? colors.success : colors.surface, opacity: hasFix ? 1 : 0.5 }]}>
          <Icon name="live" size={21} color={following ? '#fff' : colors.success} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onLocate} disabled={!hasFix} accessibilityRole="button" accessibilityLabel="موقعي" activeOpacity={0.85}
        style={[btn, { backgroundColor: colors.surface, opacity: hasFix ? 1 : 0.5 }]}>
        <Icon name="locate" size={23} color={hasFix ? colors.brand : colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}
