import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useThemeStore } from '@/stores/themeStore';

export type NazerStampKind = 'notice' | 'approved';

/**
 * الناظر's ink stamps: his crest (the shield, the laurel, his face, his name on the ribbon)
 * as one-ink line art, built from مدام روز's stamp files so the two match. Navy «اعتمد»
 * on a full month, a certificate, a receipt; red «لفت نظر» on a repeated absence or a late
 * bill. Shipped as webp like hers, tilted like hers.
 */
const STAMP: Record<NazerStampKind, { source: number; tilt: string; label: string }> = {
  approved: { source: require('../../../assets/images/nazer/stamp-navy.webp'), tilt: '-8deg', label: 'ختم الناظر — اعتمد' },
  notice: { source: require('../../../assets/images/nazer/stamp-red.webp'), tilt: '10deg', label: 'ختم الناظر — لفت نظر' },
};

// By night the navy ink sat on navy cards and vanished (founder 2026-10-24), as مدام روز's did.
// Each stamp is ONE ink with alpha, so tintColor re-inks it whole — her night inks, so the two
// still match. By day the original inks stay untouched.
const NIGHT_INK: Record<NazerStampKind, string> = { approved: '#B9C4F4', notice: '#F2647A' };

export function NazerStamp({ kind, size = 56, style }: { kind: NazerStampKind; size?: number; style?: StyleProp<ViewStyle> }) {
  const s = STAMP[kind];
  const night = useThemeStore((st) => st.scheme) === 'dark';
  return (
    <View style={[{ width: size, height: size, transform: [{ rotate: s.tilt }] }, style]} pointerEvents="none" accessibilityRole="image" accessibilityLabel={s.label}>
      <Image source={s.source} style={StyleSheet.absoluteFill} contentFit="contain" tintColor={night ? NIGHT_INK[kind] : undefined} />
    </View>
  );
}
