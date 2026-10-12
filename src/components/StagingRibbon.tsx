import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IS_STAGING } from '@/config/env';
import { fonts } from '@/theme/typography';

/**
 * A small «تجريبي» tag in the corner of EVERY screen of a staging build, so nobody mistakes
 * the staging app for the real one on a phone that carries both. Renders nothing in production.
 */
export function StagingRibbon() {
  const insets = useSafeAreaInsets();
  if (!IS_STAGING) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 4, left: 8, zIndex: 9999, backgroundColor: '#B45309', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.5 }}>STAGING · تجريبي</Text>
    </View>
  );
}
