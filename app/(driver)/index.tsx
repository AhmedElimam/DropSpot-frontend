import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { Redirect, router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber, formatTime } from '@/utils/format';
import { LiveMap, useMyLocation } from '@/components/LiveMap';
import { Banner } from '@/components/ui/Form';
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

/**
 * The rider's home, map first (founder 2026-10-14: «live location like Talabat»): his own
 * live dot on the navy map, the trip in hand drawn on it, and the day's trips in a panel
 * below. While he is free and on this screen his position reaches the shop every 45 s, so
 * the shop sees who is «متاح».
 */
export default function DriverHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const token = useDriverStore((s) => s.token);
  const driver = useDriverStore((s) => s.driver);
  const setDriver = useDriverStore((s) => s.setDriver);
  const signOut = useDriverStore((s) => s.signOut);
  const me = useQuery({ queryKey: ['driver-me'], queryFn: driverMe, enabled: !!token, retry: false });
  const trips = useQuery({ queryKey: ['driver-deliveries'], queryFn: getDriverDeliveries, enabled: !!token, refetchInterval: 20000, retry: false });
  const { refreshing, onRefresh } = usePullRefresh(trips.refetch, me.refetch);
  const here = useMyLocation(!!token);
  const [beatAt, setBeatAt] = useState<number | null>(null);

  // Free and on this screen: «I'm here» to the shop every 45 s.
  const list = trips.data ?? [];
  const active = list.filter((d) => d.is_active);
  const done = list.filter((d) => !d.is_active);
  const free = !!token && active.length === 0;
  const lastBeat = useRef(0);
  useEffect(() => {
    if (!free || !here.me) return;
    if (Date.now() - lastBeat.current < 45000) return;
    lastBeat.current = Date.now();
    driverHeartbeat(here.me.lat, here.me.lng).then(() => setBeatAt(Date.now())).catch(() => {});
  }, [free, here.me]);

  useEffect(() => { if (me.data) setDriver(me.data); }, [me.data, setDriver]);
  // A cut driver (the shop switched them off) is sent out.
  const cut = (me.error as any)?.response?.status === 401 || (trips.error as any)?.response?.status === 401;
  useEffect(() => { if (cut) signOut().then(() => router.replace('/resolve' as Href)); }, [cut, signOut]);
  if (!token) return <Redirect href={'/resolve' as Href} />;

  const now = active[0];
  const shopPin = now?.shop.lat != null && now?.shop.lng != null ? { lat: now.shop.lat, lng: now.shop.lng, label: now.shop.name ?? undefined } : null;
  const destPin = now?.dest.lat != null && now?.dest.lng != null ? { lat: now.dest.lat, lng: now.dest.lng, label: now.dest.name ?? undefined } : null;
  const online = !!beatAt || active.length > 0;
  const leave = () => Alert.alert(t('driver.sign_out'), t('driver.sign_out_confirm'), [
    { text: t('common.back'), style: 'cancel' },
    { text: t('driver.sign_out'), style: 'destructive', onPress: () => signOut().then(() => router.replace('/resolve' as Href)) },
  ]);
  const panelTop = Math.round(H * 0.5);

  return (
    <View style={{ flex: 1, backgroundColor: '#0E1433' }}>
      <StatusBar style="light" />
      <LiveMap mapsKey={driver?.maps_key ?? me.data?.maps_key} showMe rounded={false} height="100%" style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }}
        shop={shopPin} dest={destPin} controlsBottom={H - panelTop + 16} padBottom={H - panelTop}
        teacher={now?.teacher_live ? { lat: now.teacher_live.lat, lng: now.teacher_live.lng, label: t('driver.teacher_here') } : null} />

      {/* who and the status, over the map */}
      <View style={{ position: 'absolute', top: insets.top + 8, start: spacing.lg, end: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(10,14,39,0.86)', borderRadius: 24, padding: 6, paddingEnd: spacing.md }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onAccent }}>{(driver?.name ?? me.data?.name ?? '؟').slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: '#fff' }} numberOfLines={1}>{driver?.name ?? me.data?.name ?? t('driver.title')}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }} numberOfLines={1}>{t('driver.rides_for', { shop: driver?.shop.name ?? me.data?.shop.name ?? '' })}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: online ? 'rgba(43,212,138,0.18)' : 'rgba(255,255,255,0.1)' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? '#2BD48A' : '#8A91A3' }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: online ? '#2BD48A' : 'rgba(255,255,255,0.7)' }}>{here.denied ? t('driver.no_gps') : online ? t('driver.online') : t('driver.connecting')}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={leave} accessibilityRole="button" accessibilityLabel={t('driver.sign_out')}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.md }}>
          <Icon name="logout" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* the day's trips */}
      <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, top: panelTop, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadows.lg }}>
        <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginTop: 8 }} />
        {trips.isLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} /> : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
            {here.denied ? <Banner tone="warn" icon="gps" text={t('driver.gps_denied')} /> : null}
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
    </View>
  );
}
