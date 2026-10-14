import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Field, Input, Banner } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { LiveMap } from '@/components/LiveMap';
import { formatNumber } from '@/utils/format';
import { getDriverDelivery, deliveryStep, deliveryPing, deliveryDeliver, deliveryFail, DELIVERY_FLOW, type DriverDelivery } from '@/api/driver';
import { TONE } from './index';

/** Turn-by-turn in whatever maps app the phone has. */
function openDirections(lat: number, lng: number, label?: string | null) {
  const q = `${lat},${lng}`;
  const url = Platform.OS === 'ios' ? `maps://?daddr=${q}&dirflg=d` : `google.navigation:q=${q}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}${label ? `&destination_place_id=` : ''}`));
}

/**
 * One trip, the rider's way: the map with the pin, the teacher's phone, one big button per
 * step. While the trip is active the phone's position goes up every few seconds, so the
 * teacher watches the dot and the server calls «arrived» by itself near the pin.
 */
export default function DriverTrip() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const trip = useQuery({ queryKey: ['driver-delivery', id], queryFn: () => getDriverDelivery(id!), enabled: !!id, refetchInterval: 15000 });
  const d = trip.data;
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState('');
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const watch = useRef<Location.LocationSubscription | null>(null);
  const lastSent = useRef(0);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['driver-delivery', id] }); qc.invalidateQueries({ queryKey: ['driver-deliveries'] }); };
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); refresh(); if (done) Alert.alert('', done); }
    catch (e: any) { Alert.alert(t('common.error'), e?.response?.data?.message ?? t('print.failed')); }
    finally { setBusy(false); }
  };

  // Position streaming: on while the trip is in hand, off the moment it closes.
  const active = !!d?.is_active;
  const streaming = active && (d!.status === 'picked_up' || d!.status === 'en_route' || d!.status === 'arrived' || d!.status === 'assigned');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!streaming) { watch.current?.remove(); watch.current = null; return; }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsDenied(true); return; }
      setGpsDenied(false);
      if (cancelled) return;
      watch.current?.remove();
      watch.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 15 }, async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(p);
        if (Date.now() - lastSent.current < 7000) return;
        lastSent.current = Date.now();
        try {
          const r = await deliveryPing(Number(id), p.lat, p.lng, pos.coords.speed ?? null);
          if (r.status !== d?.status) refresh();
        } catch { /* the next fix retries */ }
      });
    })();
    return () => { cancelled = true; watch.current?.remove(); watch.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, id]);

  if (!d) {
    return <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.lg, alignItems: 'center' }}><Text style={{ fontFamily: fonts.medium, color: colors.textSecondary }}>{t('common.loading')}</Text></View>;
  }
  const tone = TONE()[d.tone];
  const dest = d.dest.lat != null && d.dest.lng != null ? { lat: d.dest.lat, lng: d.dest.lng } : null;
  const shop = d.shop.lat != null && d.shop.lng != null ? { lat: d.shop.lat, lng: d.shop.lng } : null;
  const stepIdx = DELIVERY_FLOW.indexOf(d.status as any);

  const primary = (() => {
    switch (d.status) {
      case 'assigned': return { label: t('driver.btn_pickup'), go: () => run(() => deliveryStep(d.id, 'pickup')) };
      case 'picked_up': return { label: t('driver.btn_enroute'), go: () => run(() => deliveryStep(d.id, 'enroute'), t('driver.enroute_ok')) };
      case 'en_route': return { label: t('driver.btn_arrived'), go: () => run(() => deliveryStep(d.id, 'arrived')) };
      default: return null;
    }
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" hitSlop={10} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="forward" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={1}>{d.job.title}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{t('print.copies_x_pages', { copies: formatNumber(d.job.copies), pages: formatNumber(d.job.pages) })} · {d.job.spec_label}</Text>
        </View>
        <View style={{ backgroundColor: tone.bg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tone.fg }}>{d.label}</Text></View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <LiveMap shop={shop} dest={dest} me={me} height={240} />
        {gpsDenied ? <View style={{ marginTop: spacing.sm }}><Banner tone="warn" icon="gps" text={t('driver.gps_denied')} /></View> : null}

        {/* the walk */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
          {DELIVERY_FLOW.map((s, i) => (
            <View key={s} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: i < stepIdx ? colors.success : i === stepIdx ? colors.brand : colors.surfaceSunken }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: i <= stepIdx ? colors.onPrimary : colors.textTertiary }}>{i < stepIdx ? '✓' : i + 1}</Text>
              </View>
              {i < DELIVERY_FLOW.length - 1 ? <View style={{ flex: 1, height: 2, backgroundColor: i < stepIdx ? colors.success : colors.border }} /> : null}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          {DELIVERY_FLOW.map((s) => <Text key={s} style={{ fontFamily: fonts.medium, fontSize: 9.5, color: colors.textTertiary }}>{t(`driver.step_${s}`)}</Text>)}
        </View>

        {/* where and who */}
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="location" size={20} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{d.dest.name || d.job.teacher || t('driver.destination')}</Text>
              {d.dest.address ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>{d.dest.address}</Text> : null}
              {d.remaining_km != null ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textTertiary, marginTop: 2 }}>{t('print.km_away', { km: formatNumber(d.remaining_km, { maximumFractionDigits: 1 }) })}{d.eta_min ? ` · ${t('driver.eta', { m: formatNumber(d.eta_min) })}` : ''}</Text> : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            {dest ? <View style={{ flex: 1 }}><Button title={t('driver.navigate')} variant="outline" onPress={() => openDirections(dest.lat, dest.lng, d.dest.name)} /></View> : null}
            {d.job.teacher_phone ? <View style={{ flex: 1 }}><Button title={t('driver.call_teacher')} variant="outline" onPress={() => Linking.openURL(`tel:${d.job.teacher_phone}`)} /></View> : null}
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>{t('driver.from_shop', { shop: d.shop.name ?? '' })}{d.shop.address ? ` · ${d.shop.address}` : ''}</Text>
        </View>

        {/* the door */}
        {d.status === 'arrived' || d.status === 'en_route' ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 2, borderColor: colors.success, padding: spacing.md, marginTop: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('driver.code_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 19 }}>{t('driver.code_sub')}</Text>
            <View style={{ marginTop: spacing.sm }}>
              <Input value={code} onChangeText={(v) => setCode(v.replace(/[^0-9٠-٩]/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="••••" center style={{ fontSize: 26, letterSpacing: 10 }} />
            </View>
            <View style={{ marginTop: spacing.sm }}><Button title={t('driver.btn_deliver')} onPress={() => run(() => deliveryDeliver(d.id, code), t('driver.delivered_ok'))} loading={busy} disabled={code.length < 4} /></View>
          </View>
        ) : null}

        {d.status === 'failed' && d.fail_reason ? <View style={{ marginTop: spacing.md }}><Banner tone="danger" text={d.fail_reason} /></View> : null}
        {d.status === 'delivered' ? <View style={{ marginTop: spacing.md }}><Banner tone="success" text={t('driver.delivered_banner')} /></View> : null}

        {active ? (
          <View style={{ marginTop: spacing.lg }}>
            {failing ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.dangerLight, padding: spacing.md }}>
                <Field label={t('driver.fail_reason')} first><Input value={reason} onChangeText={setReason} placeholder={t('driver.fail_ph')} maxLength={300} /></Field>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                  <View style={{ flex: 1 }}><Button title={t('common.back')} variant="outline" onPress={() => setFailing(false)} /></View>
                  <View style={{ flex: 1 }}><Button title={t('driver.btn_fail')} variant="destructive" onPress={() => run(() => deliveryFail(d.id, reason.trim() || t('driver.fail_default')))} loading={busy} /></View>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setFailing(true)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 8 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.dangerText }}>{t('driver.cant_deliver')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </ScrollView>

      {primary ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Button title={primary.label} onPress={primary.go} loading={busy} />
          {streaming && me ? <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.successText, textAlign: 'center', marginTop: 6 }}>{t('driver.sharing_location')}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
