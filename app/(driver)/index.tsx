import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { Redirect, router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber, formatTime } from '@/utils/format';
import { useEffect } from 'react';
import * as Location from 'expo-location';
import { getDriverDeliveries, driverMe, driverHeartbeat, type DriverDelivery } from '@/api/driver';
import { useDriverStore } from '@/stores/driverStore';

export const TONE = (): Record<DriverDelivery['tone'], { bg: string; fg: string }> => ({
  warning: { bg: colors.warningLight, fg: colors.warningText },
  info: { bg: colors.brandTint, fg: colors.brand },
  success: { bg: colors.successLight, fg: colors.successText },
  danger: { bg: colors.dangerLight, fg: colors.dangerText },
  gray: { bg: colors.surfaceSunken, fg: colors.textSecondary },
});

function TripRow({ d }: { d: DriverDelivery }) {
  const { t } = useTranslation();
  const tone = TONE()[d.tone];
  return (
    <TouchableOpacity onPress={() => router.push(`/(driver)/${d.id}` as Href)} activeOpacity={0.85} accessibilityRole="button"
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: d.is_active ? colors.accent : colors.border, borderStartWidth: 5, borderStartColor: tone.fg, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="print" size={22} color={tone.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{d.job.title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{t('driver.to', { name: d.dest.name || d.job.teacher || '' })} · {d.dest.address ?? ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ backgroundColor: tone.bg, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: tone.fg }}>{d.label}</Text></View>
          {d.remaining_km != null && d.is_active ? <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary, marginTop: 3 }}>{t('print.km_away', { km: formatNumber(d.remaining_km, { maximumFractionDigits: 1 }) })}</Text> : null}
        </View>
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>{t('print.copies_x_pages', { copies: formatNumber(d.job.copies), pages: formatNumber(d.job.pages) })} · {d.job.spec_label}{d.assigned_at ? ' · ' + formatTime(d.assigned_at) : ''}</Text>
    </TouchableOpacity>
  );
}

/** The rider's day: the trips the shop handed over, active first, today's finished ones after. */
export default function DriverHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const token = useDriverStore((s) => s.token);
  const driver = useDriverStore((s) => s.driver);
  const setDriver = useDriverStore((s) => s.setDriver);
  const signOut = useDriverStore((s) => s.signOut);
  const me = useQuery({ queryKey: ['driver-me'], queryFn: driverMe, enabled: !!token, retry: false });
  const trips = useQuery({ queryKey: ['driver-deliveries'], queryFn: getDriverDeliveries, enabled: !!token, refetchInterval: 20000, retry: false });
  const { refreshing, onRefresh } = usePullRefresh(trips.refetch, me.refetch);
  // Free and on this screen: tell the shop where you are every 45 s («متاح» on its map).
  const free = !!token && !(trips.data ?? []).some((d) => d.is_active);
  useEffect(() => {
    if (!free) return;
    let alive = true;
    const beat = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        const ok = perm.granted || (perm.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
        if (!ok || !alive) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (alive) await driverHeartbeat(pos.coords.latitude, pos.coords.longitude);
      } catch { /* the next beat retries */ }
    };
    beat();
    const timer = setInterval(beat, 45000);
    return () => { alive = false; clearInterval(timer); };
  }, [free]);
  if (!token) return <Redirect href={'/(driver)/login' as Href} />;
  if (me.data && me.data !== driver) setDriver(me.data);
  // A cut driver (the shop switched them off) is sent out.
  if ((me.error as any)?.response?.status === 401 || (trips.error as any)?.response?.status === 401) { signOut().then(() => router.replace('/(driver)/login' as Href)); }

  const list = trips.data ?? [];
  const active = list.filter((d) => d.is_active);
  const done = list.filter((d) => !d.is_active);
  const leave = () => Alert.alert(t('driver.sign_out'), t('driver.sign_out_confirm'), [
    { text: t('common.back'), style: 'cancel' },
    { text: t('driver.sign_out'), style: 'destructive', onPress: () => signOut().then(() => router.replace('/(auth)/login' as Href)) },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="gps" size={24} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.onHero }} numberOfLines={1}>{driver?.name ?? me.data?.name ?? t('driver.title')}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.onHeroSoft }} numberOfLines={1}>{t('driver.rides_for', { shop: driver?.shop.name ?? me.data?.shop.name ?? '' })}</Text>
          </View>
          <TouchableOpacity onPress={leave} accessibilityRole="button" hitSlop={8} style={{ paddingHorizontal: 12, height: 34, borderRadius: radius.full, backgroundColor: colors.onHeroChip, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.onHero }}>{t('driver.sign_out')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {trips.isLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} /> : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
          {list.length === 0 ? (
            <EmptyState icon="print" title={t('driver.empty_title')} message={t('driver.empty_sub')} />
          ) : (
            <>
              {active.length ? <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm }}>{t('driver.active_n', { n: formatNumber(active.length) })}</Text> : null}
              {active.map((d) => <TripRow key={d.id} d={d} />)}
              {done.length ? <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm }}>{t('driver.done_today')}</Text> : null}
              {done.map((d) => <TripRow key={d.id} d={d} />)}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
