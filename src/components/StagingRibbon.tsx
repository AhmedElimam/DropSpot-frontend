import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IS_STAGING } from '@/config/env';
import { fonts } from '@/theme/typography';
import { useAuthStore } from '@/stores/authStore';

/**
 * A small «STAGING» tag in the corner of the SIGN-IN screens of a staging build, so nobody
 * signs into the staging app thinking it is the real one on a phone that carries both. Once
 * signed in it is gone (founder 2026-10-28: a label on every screen reads as part of the
 * product); the app's own name on the home screen tells the two apart. Renders nothing in
 * production.
 */
export function StagingRibbon() {
  const insets = useSafeAreaInsets();
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  if (!IS_STAGING || signedIn) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 4, left: 8, zIndex: 9999, backgroundColor: '#B45309', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.5 }}>STAGING · تجريبي</Text>
    </View>
  );
}
