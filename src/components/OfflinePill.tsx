import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { useOfflineStore } from '@/stores/offlineStore';

type Kind = 'offline' | 'weak' | 'queued' | 'back';
const SHOW_MS: Record<Kind, number> = { offline: 5000, weak: 4000, queued: 3000, back: 2500 };

/**
 * A pill at the top for a few seconds when the connection drops («لا يوجد اتصال — المعروض
 * آخر ما حُفظ على هاتفك»), when it is there but dropping requests («الاتصال ضعيف»), when an
 * action was parked to be sent later («تم الحفظ بدون اتصال»), and briefly when the
 * connection returns. Floats over the header instead of pushing every screen down, and
 * leaves on its own: the screens keep showing their saved data underneath
 * (src/lib/queryPersist.ts), so there is nothing to keep warning about.
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
  const weak = useOfflineStore((s) => s.weak);
  const queuedAt = useOfflineStore((s) => s.lastQueued?.at ?? 0);
  const [shown, setShown] = useState<Kind | null>(null);
  const wasOnline = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (kind: Kind) => {
    if (timer.current) clearTimeout(timer.current);
    setShown(kind);
    timer.current = setTimeout(() => { timer.current = null; setShown(null); }, SHOW_MS[kind]);
  };

  useEffect(() => {
    if (online === wasOnline.current) return;
    wasOnline.current = online;
    show(online ? 'back' : 'offline');
  }, [online]);

  useEffect(() => {
    if (weak && online) show('weak');
  }, [weak, online]);

  useEffect(() => {
    if (queuedAt) show('queued');
  }, [queuedAt]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!shown) return null;
  const tone = shown === 'back' ? colors.successDark : shown === 'queued' ? colors.primaryDark : colors.ink;
  const text = shown === 'back' ? t('offline_pill.back')
    : shown === 'offline' ? t('offline_pill.offline')
    : shown === 'weak' ? t('offline.weak')
    : t('offline.queued');
  return (
    <Animated.View
      key={shown}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(300)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute', top: insets.top + 6, alignSelf: 'center', maxWidth: '92%',
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: tone,
      }}
    >
      <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.textInverse, textAlign: 'center' }}>
        {text}
      </Text>
    </Animated.View>
  );
}
