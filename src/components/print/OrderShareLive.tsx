import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { headingOf, type MyPoint } from '@/components/LiveMap';
import { locatePrintJob } from '@/api/print';

export type ShareState = 'off' | 'starting' | 'on' | 'denied';

/**
 * The teacher's own live position for the driver (founder 2026-10-14: «another locator for
 * live location exposing to the driver»). OFF until the teacher turns it on; once on, it
 * stays on for this job while the screen is open, and stops by itself when the trip ends.
 * Foreground only: watches the phone (high accuracy, ~10 s / 15 m) and sends a point to the
 * server at most every 15 s.
 */
export function useOrderLiveShare(id: string | undefined, tripLive: boolean) {
  const [wanted, setWanted] = useState(false);
  const [state, setState] = useState<ShareState>('off');
  const [me, setMe] = useState<MyPoint | null>(null);

  // The trip is over: the switch goes back to off.
  useEffect(() => { if (!tripLive) setWanted(false); }, [tripLive]);

  useEffect(() => {
    if (!wanted || !tripLive || !id) {
      setMe(null);
      setState((s) => (s === 'denied' ? s : 'off'));
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let last = 0;
    let gone = false;
    setState('starting');
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' as const }));
      if (gone) return;
      if (status !== 'granted') { setState('denied'); setWanted(false); return; }
      setState('on');
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 15 }, (pos) => {
        if (gone) return;
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe({ ...p, heading: headingOf(pos) });
        if (Date.now() - last < 15000) return;
        last = Date.now();
        locatePrintJob(id, p.lat, p.lng).catch(() => {});
      });
      if (gone) sub.remove();
    })();
    return () => { gone = true; sub?.remove(); };
  }, [wanted, tripLive, id]);

  return { state, me, on: wanted, toggle: () => setWanted((w) => !w) };
}

/** The live dot: a soft ring breathing out of a solid centre (native driver, only while on). */
function PulseDot({ color }: { color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }] }} />
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
    </View>
  );
}

/**
 * The switch itself, a pill for a map corner: «شارك موقعك مع السائق» when off, a green
 * «موقعك ظاهر للسائق» with a breathing dot when on (tap again to stop).
 */
export function OrderShareLivePill({ state, onPress }: { state: ShareState; onPress: () => void }) {
  const { t } = useTranslation();
  const on = state === 'on';
  const starting = state === 'starting';
  return (
    <TouchableOpacity onPress={onPress} disabled={starting} accessibilityRole="switch" accessibilityState={{ checked: on, busy: starting }}
      accessibilityLabel={on ? t('print.order_share_on') : t('print.order_share_live')} activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 40, paddingStart: on ? 12 : 10, paddingEnd: 14, borderRadius: radius.full,
        backgroundColor: on ? colors.success : colors.surface, borderWidth: on ? 0 : 1.5, borderColor: colors.brand, ...shadows.md }}>
      {on ? <PulseDot color={colors.onPrimary} /> : (
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="gps" size={15} color={colors.brand} />
        </View>
      )}
      <View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? colors.onPrimary : colors.brand }} numberOfLines={1}>
          {on ? t('print.order_share_on') : starting ? t('print.order_share_starting') : t('print.order_share_live')}
        </Text>
        {on ? <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.onPrimary, opacity: 0.85, marginTop: -2 }} numberOfLines={1}>{t('print.order_share_stop')}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}
