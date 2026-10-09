import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors } from '@/theme/index';
import { fonts } from '@/theme/typography';

const OFFLINE_SHOW_MS = 5000;
const BACK_SHOW_MS = 2500;

/**
 * A pill at the top for a few seconds when the connection drops («لا يوجد اتصال — المعروض آخر
 * ما حُفظ على هاتفك») and briefly when it returns. Floats over the header instead of pushing
 * every screen down, and leaves on its own: the screens keep showing their saved data
 * underneath (src/lib/queryPersist.ts), so there is nothing to keep warning about.
 *
 * Its own NetInfo subscription, read-only: the teacher layout's listener owns the offline
 * store and the scan auto-sync, and must keep seeing the offline→online edge itself.
 */
export function OfflinePill() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const net = useNetInfo();
  // Unknown (null) at launch counts as online — no flash before the first real answer.
  const online = net.isConnected !== false && net.isInternetReachable !== false;
  const [shown, setShown] = useState<'offline' | 'back' | null>(null);
  const wasOnline = useRef(true);

  useEffect(() => {
    if (online === wasOnline.current) return;
    wasOnline.current = online;
    setShown(online ? 'back' : 'offline');
    const id = setTimeout(() => setShown(null), online ? BACK_SHOW_MS : OFFLINE_SHOW_MS);
    return () => clearTimeout(id);
  }, [online]);

  if (!shown) return null;
  const back = shown === 'back';
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(300)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute', top: insets.top + 6, alignSelf: 'center', maxWidth: '92%',
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
        backgroundColor: back ? colors.successDark : colors.ink,
      }}
    >
      <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.textInverse, textAlign: 'center' }}>
        {t(back ? 'offline_pill.back' : 'offline_pill.offline')}
      </Text>
    </Animated.View>
  );
}
