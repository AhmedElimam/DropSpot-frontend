import { useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Alert } from '@/ui/dialog';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { FormScreen, Banner } from '@/components/ui/Form';
import { formatNumber, formatShortDate, formatDateTime } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { LiveMap, MAP_BG } from '@/components/LiveMap';
import { ShopLogo } from '@/components/print/ShopLogo';
import { OrderHero } from '@/components/print/OrderHero';
import { OrderDriverCard } from '@/components/print/OrderDriverCard';
import { OrderSharePanel, useOrderShare } from '@/components/print/OrderShareLive';
import { OrderSpecCard } from '@/components/print/OrderSpecCard';
import { OrderReceipt } from '@/components/print/OrderReceipt';
import { OrderPayCard } from '@/components/print/OrderPayCard';
import { OrderReceiveCard, OrderRatedCard } from '@/components/print/OrderReceiveCard';
import { OrderReorderTile, OrderCancelButton } from '@/components/print/OrderActions';
import { useAuthStore } from '@/stores/authStore';
import { useArrived } from '@/hooks/useArrived';
import { useThemeStore } from '@/stores/themeStore';
import {
  getPrintJob, getPrintOptions, cancelPrintJob, receivePrintJob, reorderPrintJob, claimPrintPayment, trackPrintJob, getReceiveJob, trackReceive } from '@/api/print';

const MAP_H = 300;
/** How much of the map's lower edge the driver card covers. */
const OVERLAP = 44;

/**
 * One print job, as a delivery app shows an order (founder 2026-10-14: «some love on print
 * order page»): the status hero with the walk, the live map with the driver card on its edge
 * and the teacher's own «share my location» switch, then the shop, the spec card, the
 * receipt, and the two things only the teacher can do — tell the platform it was paid, and
 * confirm the prints are in hand (src/components/print/Order*.tsx).
 */
export default function PrintJobScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const arrived = useArrived();
  const mapBg = MAP_BG[useThemeStore((st) => st.scheme) === 'dark' ? 'dark' : 'light'];
  // An assistant with «receive_prints» opens the same page through the receiving end: the
  // trip, the code and sharing — never the money (the server leaves it out).
  const isAssistant = useAuthStore((st) => st.role === 'assistant');
  const job = useQuery({ queryKey: ['print-job', id, isAssistant], queryFn: () => (isAssistant ? getReceiveJob(id!) : getPrintJob(id)), enabled: !!id, refetchInterval: 30000 });
  const options = useQuery({ queryKey: ['print-options'], queryFn: getPrintOptions });
  // Live once there is something to watch: a trip in hand, or a ready job waiting for its code.
  const watch = !!job.data && (job.data.status === 'ready' || job.data.status === 'delivered' || job.data.status === 'printing');
  const track = useQuery({ queryKey: ['print-track', id], queryFn: () => (isAssistant ? trackReceive(id!) : trackPrintJob(id!)), enabled: !!id && watch, refetchInterval: (q) => (q.state.data?.delivery?.is_active ? 8000 : 30000) });
  // While a driver is on the way, show the driver where you are — WhatsApp's two ways
  // (founder 2026-10-14): a fixed pin at once, or live for 15 min / 1 h / 8 h from the
  // background. The teacher or an assistant at the centre.
  const tripLive = !!track.data?.delivery?.is_active;
  const share = useOrderShare(id ? Number(id) : null, tripLive, track.data?.teacher_live);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState('');
  const [method, setMethod] = useState<string>('instapay');
  const [reference, setReference] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const j = job.data;

  const refresh = () => { qc.invalidateQueries({ queryKey: ['print-job', id] }); qc.invalidateQueries({ queryKey: ['print-jobs'] }); };
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); refresh(); if (done) Alert.alert('', done); }
    catch (e: any) { Alert.alert(t('common.error'), e?.response?.data?.message ?? t('print.failed')); }
    finally { setBusy(false); }
  };

  const cancel = () => j && Alert.alert(t('print.cancel_title'), t('print.cancel_confirm', { shop: j.shop.name ?? '' }), [
    { text: t('common.back'), style: 'cancel' },
    { text: t('print.cancel'), style: 'destructive', onPress: () => run(() => cancelPrintJob(j.id)) },
  ]);
  const receive = () => j && run(() => receivePrintJob(j.id, rating, review.trim() || undefined), t('print.received_ok'));
  const reorder = () => j && Alert.alert(t('print.reorder'), t('print.reorder_confirm', { shop: j.shop.name ?? '' }), [
    { text: t('common.back'), style: 'cancel' },
    { text: t('print.reorder'), onPress: () => run(async () => { const n = await reorderPrintJob(j.id); router.replace(`/(teacher)/print/${n.id}` as Href); }) },
  ]);
  const pickProof = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setProofUri(r.assets[0].uri);
  };
  const claim = () => j && run(() => claimPrintPayment(j.id, { method, reference: reference.trim() || undefined, proofUri }), t('print.claimed_ok'));

  const payTo = options.data?.pay_to;
  const tr = track.data;
  const d = tr?.delivery ?? null;
  const showTrack = !!tr && !!(tr.handover_code || tr.delivery);
  const showMap = !!tr && !!(tr.delivery?.is_active || tr.mode === 'pickup') && !!(tr.dest || tr.shop.lat != null);
  const showCode = !!j && j.status !== 'delivered' && j.status !== 'received';

  // The hero's words: what is happening now, and one line on when.
  const heroTitle = j ? (d?.is_active ? d.label : j.status_label) : '';
  const heroLine = !j ? null
    : d?.is_active ? (d.eta_min ? t('print.track_eta', { m: formatNumber(d.eta_min) }) : d.status === 'arrived' ? t('print.track_arrived') : d.remaining_km != null ? t('print.km_away', { km: formatNumber(d.remaining_km, { maximumFractionDigits: 1 }) }) : null)
    : j.status === 'sent' ? t('print.sent_hint')
    : j.status === 'received' && j.received_at ? t('print.order_received_at', { at: formatDateTime(j.received_at) })
    : j.status === 'cancelled' && j.cancelled_at ? t('print.order_cancelled_at', { at: formatDateTime(j.cancelled_at) })
    : j.due_at && j.is_open ? t('print.due', { at: formatShortDate(j.due_at) })
    : null;

  const pill = <OrderSharePanel share={share} />;

  return (
    <Surface id="screen.teacher.print_job" screen>
    <FormScreen title={j?.title ?? t('print.job')} subtitle={j ? t('print.copies_x_pages', { copies: formatNumber(j.copies), pages: formatNumber(j.pages) }) + ' · ' + j.spec_label : null} loading={job.isLoading}>
      {j ? (
        <>
          <Surface id="teacher.print_job.status">
            <OrderHero j={j} title={heroTitle} line={heroLine} onRoad={tripLive} />
            {j.status === 'declined' && j.decline_reason ? <Banner tone="danger" text={t('print.declined_reason', { reason: j.decline_reason })} /> : null}
          </Surface>

          {showTrack && tr ? (
            <Surface id="teacher.print_job.track">
              {showMap ? (
                <View style={{ marginBottom: spacing.md }}>
                  {arrived ? (
                    <LiveMap mapsKey={tr.maps_key} height={MAP_H} style={{ borderRadius: radius.xxl }} padBottom={OVERLAP}
                      shop={tr.shop.lat != null ? { lat: tr.shop.lat, lng: tr.shop.lng!, label: tr.shop.name ?? undefined, logo: tr.shop.logo ?? null } : null}
                      dest={tr.dest ? { lat: tr.dest.lat, lng: tr.dest.lng, label: tr.dest.name ?? undefined } : null}
                      driver={d?.driver?.lat != null ? { lat: d.driver.lat, lng: d.driver.lng!, label: d.driver.name, vehicle: d.driver.vehicle, busy: d.is_active, online: d.driver.online } : null}
                      follow={d?.driver?.lat != null ? { lat: d.driver.lat, lng: d.driver.lng! } : null}
                      me={share.me ? { ...share.me, label: share.mode === 'static' ? t('print.share_pin_label') : t('print.me') } : null} trail={d?.trail ?? []} />
                  ) : <View style={{ height: MAP_H, borderRadius: radius.xxl, backgroundColor: mapBg }} />}
                  {tripLive ? (
                    <View style={{ position: 'absolute', top: spacing.md, start: spacing.md }}>
                      <Surface id="teacher.print_job.share_live">{pill}</Surface>
                    </View>
                  ) : null}
                  <OrderDriverCard track={tr} showCode={showCode} overlap />
                </View>
              ) : (
                <>
                  {tripLive ? <View style={{ alignItems: 'flex-start', marginBottom: spacing.sm }}><Surface id="teacher.print_job.share_live">{pill}</Surface></View> : null}
                  <OrderDriverCard track={tr} showCode={showCode} overlap={false} />
                </>
              )}
            </Surface>
          ) : null}

          <Surface id="teacher.print_job.shop">
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <ShopLogo logo={j.shop.logo ?? tr?.shop.logo ?? null} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }}>{t('print.shop')}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{j.shop.name ?? t('print.shop')}</Text>
                  {j.shop.city ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{j.shop.city}</Text> : null}
                </View>
                {j.shop.phone ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${j.shop.phone}`)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.full, backgroundColor: colors.accentLight }}>
                    <Icon name="call" size={16} color={colors.accentText} /><Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.accentText }}>{t('print.call')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {/* Where the prints meet the teacher — a soft tile, like the spec's. */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: j.spec.delivery_mode === 'deliver' ? colors.accentLight : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={j.spec.delivery_mode === 'deliver' ? 'delivery' : 'location'} size={17} color={j.spec.delivery_mode === 'deliver' ? colors.accentText : colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>
                    {j.spec.delivery_mode === 'deliver' ? t('print.order_deliver_to') : t('print.pickup_at')}
                  </Text>
                  {j.spec.delivery_mode === 'deliver' ? (
                    <>
                      {j.dest?.name ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{j.dest.name}</Text> : null}
                      {j.delivery_address ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{j.delivery_address}</Text> : null}
                    </>
                  ) : j.branch ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{[j.branch.name, j.branch.address].filter(Boolean).join('، ')}</Text>
                  ) : [j.shop.address, j.shop.city].filter(Boolean).length ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{[j.shop.address, j.shop.city].filter(Boolean).join('، ')}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </Surface>

          <Surface id="teacher.print_job.spec">
            <OrderSpecCard j={j} options={options.data} />
          </Surface>

          <Surface id="teacher.print_job.money" assistantNeeds="teacher">
            <OrderReceipt j={j} />
          </Surface>

          {j.status !== 'cancelled' && j.status !== 'declined' ? (
            <Surface id="teacher.print_job.payment" assistantNeeds="teacher">
              <OrderPayCard j={j} payTo={payTo} method={method} onMethod={setMethod} reference={reference} onReference={setReference}
                proofUri={proofUri} onPickProof={pickProof} onClaim={claim} busy={busy} />
            </Surface>
          ) : null}

          {j.can_receive ? (
            <Surface id="teacher.print_job.receive" assistantNeeds="teacher">
              <OrderReceiveCard rating={rating} onRating={setRating} review={review} onReview={setReview} onConfirm={receive} busy={busy} />
            </Surface>
          ) : j.status === 'received' && j.rating != null ? (
            <Surface id="teacher.print_job.receive" assistantNeeds="teacher">
              <OrderRatedCard rating={j.rating} review={j.review} />
            </Surface>
          ) : null}

          {!j.is_open || j.can_cancel ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              {!j.is_open ? <Surface id="teacher.print_job.reorder_button" assistantNeeds="teacher"><OrderReorderTile shop={j.shop.name} onPress={reorder} busy={busy} /></Surface> : null}
              {j.can_cancel ? <Surface id="teacher.print_job.cancel_button" assistantNeeds="teacher"><OrderCancelButton onPress={cancel} busy={busy} /></Surface> : null}
            </View>
          ) : null}
        </>
      ) : null}
    </FormScreen>
    </Surface>
  );
}
