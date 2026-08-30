import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { fonts } from '@/theme/typography';

/**
 * «عضو مميز» — the violet-gold badge for the single flagship Distinguished Member tier.
 * Just a gradient label (violet → gold). Shown to the teacher (their own app) and to
 * families (the parent teacher card). RTL-safe: flexDirection 'row' (never row-reverse).
 */
export function DistinguishedBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const small = size === 'sm';
  return (
    <LinearGradient
      colors={['#6D28D9', '#9333EA', '#F5C542']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: small ? 8 : 12,
        paddingVertical: small ? 3 : 6,
        borderRadius: 999,
      }}
    >
      <Text style={{ fontSize: small ? 10 : 12 }}>👑</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: small ? 11 : 12.5, color: '#fff' }}>عضو مميز</Text>
    </LinearGradient>
  );
}

/** Wrapper that renders the badge only for a distinguished member (keeps call sites terse). */
export function DistinguishedBadgeIf({ show, size }: { show?: boolean | null; size?: 'sm' | 'md' }) {
  if (!show) return null;
  return (
    <View>
      <DistinguishedBadge size={size} />
    </View>
  );
}
