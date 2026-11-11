import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { Redirect, router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, isDark } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber, formatTime } from '@/utils/format';
import { LiveMap, useMyLocation, MAP_BG } from '@/components/LiveMap';
import { useOnScreen } from '@/hooks/useAmbientMotion';
import { LOCATION_BEAT_MS, stopLegacyLocationTasks } from '@/utils/foregroundLocation';
import { Banner } from '@/components/ui/Form';
import { getDriverDeliveries, driverMe, driverHeartbeat, type DriverDelivery } from '@/api/driver';
import { useDriverStore } from '@/stores/driverStore';

/** «المعلّم — مباشر» / «موقع ثابت من أ. سارة»: what the dot is and who shared it. */
export function teacherLabel(t: (k: string, o?: Record<string, unknown>) => string, live: NonNullable<DriverDelivery['teacher_live']>): string {
  const who = live.by_assistant && live.by ? live.by : t('driver.the_teacher');
  return live.kind === 'static' ? t('driver.teacher_pin', { who }) : t('driver.teacher_live', { who });
}

export const TONE = (): Record<DriverDelivery['tone'], { bg: string; fg: string }> => ({
  warning: { bg: colors.warningLight, fg: colors.warningText },
  info: { bg: colors.brandTint, fg: colors.brand },
  success: { bg: colors.successLight, fg: colors.successText },
  danger: { bg: colors.dangerLight, fg: colors.dangerText },
  gray: { bg: colors.surfaceSunken, fg: colors.textSecondary },
});

/** The panel's rows: a heading over each group of trips, then the trips. */
type PanelRow = { key: string; head: string; quiet?: boolean } | { key: string; trip: DriverDelivery };

const TripRow = memo(function TripRow({ d }: { d: DriverDelivery }) {
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
});

/**
 * The rider's home, map first (founder 2026-10-14: «live location like Talabat»): himself as
 * his vehicle on the navy map, the trip in hand drawn on it, and the day's trips in a panel
 * below. «متصل» is a switch: on duty one reading of his position goes up every 30 s while
 * this screen is in front and the app is open (the trip page does the same for its trip), so
 * the shop sees him «متاح» and the teacher watches him come. Foreground only — nothing is sent
 * with the screen off (performance rule 8, founder 2026-11-12). Off duty nothing is sent.
 */
export default function DriverHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const token = useDriverStore((s) => s.token);
  const driver = useDriverStore((s) => s.driver);
  const setDriver = useDriverStore((s) => s.setDriver);
  const signOut = useDriverStore((s) => s.signOut);
  const onScreen = useOnScreen();
  const me = useQuery({ queryKey: ['driver-me'], queryFn: driverMe, enabled: !!token, retry: false });
  const trips = useQuery({ queryKey: ['driver-deliveries'], queryFn: getDriverDeliveries, enabled: !!token,
    refetchInterval: onScreen ? 30_000 : false,
    retry: false,
  });
  const { refreshing, onRefresh } = usePullRefresh(trips.refetch, me.refetch);
  const [duty, setDuty] = useState(true);
  const here = useMyLocation(!!token);
  const [beatAt, setBeatAt] = useState<number | null>(null);

  const list = trips.data;
  const active = useMemo(() => (list ?? []).filter((d) => d.is_active), [list]);
  const done = useMemo(() => (list ?? []).filter((d) => !d.is_active), [list]);

  // A background stream left running by a build from before location became foreground-only.
  useEffect(() => { void stopLegacyLocationTasks(); }, []);
  useEffect(() => { if (!duty) setBeatAt(null); }, [duty]);
  // On duty, in front: a beat every 30 s even standing still, from the map's own reading.
  const latest = useRef(here.me);
  latest.current = here.me;
  const lastBeat = useRef(0);
  const beat = () => {
    const p = latest.current;
    if (!p || Date.now() - lastBeat.current < LOCATION_BEAT_MS - 5_000) return;
    lastBeat.current = Date.now();
    driverHeartbeat(p.lat, p.lng).then(() => setBeatAt(Date.now())).catch(() => {});
  };
  const hasFix = !!here.me;
  useEffect(() => {
    if (!token || !duty || !onScreen) return;
    beat();
    const timer = setInterval(beat, LOCATION_BEAT_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, duty, onScreen, hasFix]);

  const rows = useMemo<PanelRow[]>(() => [
    ...(active.length ? [{ key: 'h-active', head: t('driver.active_n', { n: formatNumber(active.length) }) }] : []),
    ...active.map((d) => ({ key: `t${d.id}`, trip: d })),
    ...(done.length ? [{ key: 'h-done', head: t('driver.done_today'), quiet: true }] : []),
    ...done.map((d) => ({ key: `t${d.id}`, trip: d })),
  ], [active, done, t]);
  const renderRow = useCallback(({ item }: { item: PanelRow }) => ('trip' in item ? <TripRow d={item.trip} /> : (
    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: item.quiet ? colors.textSecondary : colors.textPrimary, marginTop: item.quiet ? spacing.md : 0, marginBottom: spacing.sm }}>{item.head}</Text>
  )), []);

  useEffect(() => { if (me.data) setDriver(me.data); }, [me.data, setDriver]);
  // A cut driver (the shop switched them off) is sent out.
  const cut = (me.error as any)?.response?.status === 401 || (trips.error as any)?.response?.status === 401;
  useEffect(() => { if (cut) signOut().then(() => router.replace('/resolve' as Href)); }, [cut, signOut]);
  if (!token) return <Redirect href={'/resolve' as Href} />;

  const now = active[0];
  const shopPin = now?.shop.lat != null && now?.shop.lng != null ? { lat: now.shop.lat, lng: now.shop.lng, label: now.shop.name ?? undefined, logo: now.shop.logo ?? null } : null;
  const destPin = now?.dest.lat != null && now?.dest.lng != null ? { lat: now.dest.lat, lng: now.dest.lng, label: now.dest.name ?? undefined } : null;
  const online = duty && !!beatAt;
  const meAsDriver = here.me ? { ...here.me, id: driver?.id ?? me.data?.id, vehicle: driver?.vehicle ?? me.data?.vehicle, busy: active.length > 0, online: duty, heading: here.me.heading ?? null } : null;
  const leave = () => Alert.alert(t('driver.sign_out'), t('driver.sign_out_confirm'), [
    { text: t('common.back'), style: 'cancel' },
    { text: t('driver.sign_out'), style: 'destructive', onPress: () => signOut().then(() => router.replace('/resolve' as Href)) },
  ]);
  const panelTop = Math.round(H * 0.5);

  return (
    <View style={{ flex: 1, backgroundColor: isDark() ? MAP_BG.dark : MAP_BG.light }}>
      <StatusBar style={isDark() ? 'light' : 'dark'} />
      <LiveMap mapsKey={driver?.maps_key ?? me.data?.maps_key} showMe hideMeDot rounded={false} height="100%" style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }}
        shop={shopPin} dest={destPin} driver={meAsDriver} controlsBottom={H - panelTop + 16} padBottom={H - panelTop}
        teacher={now?.teacher_live ? { lat: now.teacher_live.lat, lng: now.teacher_live.lng, static: now.teacher_live.kind === 'static', label: teacherLabel(t, now.teacher_live) } : null} />

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
          <TouchableOpacity onPress={() => setDuty((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: duty }} accessibilityLabel={t('driver.duty_switch')} hitSlop={8} activeOpacity={0.8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingStart: 4, paddingEnd: 10, height: 30, borderRadius: 15, backgroundColor: !duty ? 'rgba(255,255,255,0.1)' : online ? 'rgba(43,212,138,0.18)' : 'rgba(255,255,255,0.1)' }}>
            <View style={{ width: 34, height: 22, borderRadius: 11, padding: 2, backgroundColor: duty ? '#2BD48A' : '#5B6478', alignItems: duty ? 'flex-start' : 'flex-end' }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' }} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: !duty ? 'rgba(255,255,255,0.7)' : online ? '#2BD48A' : 'rgba(255,255,255,0.8)' }}>{!duty ? t('driver.off_duty') : here.denied ? t('driver.no_gps') : online ? t('driver.online') : t('driver.connecting')}</Text>
          </TouchableOpacity>
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
          <FlatList data={rows} keyExtractor={(r) => r.key} renderItem={renderRow}
            initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
            showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ListHeaderComponent={(
              <>
                {here.denied ? <Banner tone="warn" icon="gps" text={t('driver.gps_denied')} /> : null}
                {!duty ? <Banner tone="info" icon="gps" text={t('driver.off_duty_hint')} /> : !here.denied ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
                    <Icon name="gps" size={14} color={colors.successText} />
                    <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('driver.sharing_hint')}</Text>
                  </View>
                ) : null}
              </>
            )}
            ListEmptyComponent={<EmptyState icon="print" title={t('driver.empty_title')} message={t('driver.empty_sub')} />} />
        )}
      </View>
    </View>
  );
}
