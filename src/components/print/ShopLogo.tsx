import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { sampleSource } from '@/api/print';

/**
 * A print shop's face (founder 2026-10-14: «printshop has a logo, show it on the teacher
 * side»): its logo on white when it has one, else the storefront mark in the shop's tier
 * colour. A logo that fails to load falls back to the mark.
 */
export function ShopLogo({ logo, size = 48, premium = false, muted = false, ring = false, style }: {
  logo?: string | null; size?: number; premium?: boolean; muted?: boolean;
  /** A white ring, for a logo sitting on a photo. */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [broken, setBroken] = useState(false);
  const r = Math.round(size * 0.32);
  const border = ring ? { borderWidth: 2.5, borderColor: '#fff' } : { borderWidth: 1, borderColor: colors.border };
  if (logo && !broken) {
    return (
      <View style={[{ width: size, height: size, borderRadius: r, overflow: 'hidden', backgroundColor: '#fff', opacity: muted ? 0.75 : 1 }, border, style]}>
        <Image source={sampleSource(logo)} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={120} recyclingKey={logo} onError={() => setBroken(true)} accessibilityIgnoresInvertColors />
      </View>
    );
  }
  const bg = muted ? colors.surfaceSunken : premium ? colors.accent : colors.brandTint;
  const fg = muted ? colors.textTertiary : premium ? colors.onAccent : colors.brand;
  return (
    <View style={[{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, ring ? border : null, style]}>
      <Icon name="storefront" size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}
