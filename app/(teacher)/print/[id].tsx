import { useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Alert } from '@/ui/dialog';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { FormScreen, FormCard, Field, Input, Chips, Banner } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { formatNumber, formatShortDate, formatDateTime } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { LiveMap, MAP_BG } from '@/components/LiveMap';
import { ShopLogo } from '@/components/print/ShopLogo';
import { OrderHero } from '@/components/print/OrderHero';
import { OrderDriverCard } from '@/components/print/OrderDriverCard';
import { OrderSharePanel, useOrderShare } from '@/components/print/OrderShareLive';
import { useAuthStore } from '@/stores/authStore';
import { useArrived } from '@/hooks/useArrived';
import { useThemeStore } from '@/stores/themeStore';
import {
  getPrintJob, getPrintOptions, cancelPrintJob, receivePrintJob, reorderPrintJob, claimPrintPayment, type PrintJob, type PrintOptions, trackPrintJob, getReceiveJob, trackReceive } from '@/api/print';

const MAP_H = 300;
/** How much of the map's lower edge the driver card covers. */
const OVERLAP = 44;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingVertical: 6 }}>
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: strong ? fonts.bold : fonts.medium, fontSize: strong ? 18 : 13.5, color: colors.textPrimary }}>{value}</Text>
    </View>
  );
}

/** A clean white section: a tinted icon tile, a title, an optional thing at the end. */
function Section({ icon, title, tint, end, children }: { icon: IconName; title: string; tint: { bg: string; fg: string }; end?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={tint.fg} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{title}</Text>
        {end}
      </View>
      {children}
    </View>
  );
}

function Tag({ text, icon, tone = 'plain' }: { text: string; icon?: IconName; tone?: 'plain' | 'accent' }) {
  const bg = tone === 'accent' ? colors.accentLight : colors.surfaceSunken;
  const fg = tone === 'accent' ? colors.accentText : colors.textSecondary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: radius.full, backgroundColor: bg, borderWidth: tone === 'plain' ? 1 : 0, borderColor: colors.borderLight }}>
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: fg }} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.brand }}>{value}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** The spec as words: from the options' labels when they are here, else the job's own line. */
function specTags(j: PrintJob, o: PrintOptions | undefined, t: (k: string) => string): { text: string; icon?: IconName; tone?: 'accent' }[] {
  const label = (list: { key: string; label: string }[] | undefined, key: string | number | undefined) =>
    key == null ? null : list?.find((c) => String(c.key) === String(key))?.label ?? null;
  const out: { text: string; icon?: IconName; tone?: 'accent' }[] = [];
  if (o) {
    const size = j.spec.size && j.spec.size !== 'A4' ? label(o.sizes, j.spec.size) ?? j.spec.size : null;
    for (const v of [size, label(o.papers, j.spec.paper), label(o.inks, j.spec.ink), label(o.sides, j.spec.sides)]) if (v) out.push({ text: v });
    if (j.spec.finish && j.spec.finish !== 'none') { const f = label(o.finishes, j.spec.finish); if (f) out.push({ text: f, icon: 'book' }); }
  } else if (j.spec_label) {
    out.push({ text: j.spec_label });
  }
  if (j.spec.rush) out.push({ text: t('print.line_rush_plain'), icon: 'flash', tone: 'accent' });
  for (const x of j.extras ?? []) out.push({ text: x.name, icon: 'add' });
  return out;
}

/**
 * One print job, as a delivery app shows an order (founder 2026-10-14: «some love on print
 * order page»): the status hero with the walk, the live map with the driver card on its edge
 * and the teacher's own «share my location» switch, then the shop, the job, the money, and
 * the two things only the teacher can do — tell the platform it was paid, and confirm the
 * prints are in hand.
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
  const egp = t('teacher.egp');
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
  const money = (v: number) => `${formatNumber(v, { maximumFractionDigits: 2 })} ${egp}`;

  // The hero's words: what is happening now, and one line on when.
  const heroTitle = j ? (d?.is_active ? d.label : j.status_label) : '';
  const heroLine = !j ? null
    : d?.is_active ? (d.eta_min ? t('print.track_eta', { m: formatNumber(d.eta_min) }) : d.status === 'arrived' ? t('print.track_arrived') : d.remaining_km != null ? t('print.km_away', { km: formatNumber(d.remaining_km, { maximumFractionDigits: 1 }) }) : null)
    : j.status === 'sent' ? t('print.sent_hint')
    : j.status === 'received' && j.received_at ? t('print.order_received_at', { at: formatDateTime(j.received_at) })
    : j.status === 'cancelled' && j.cancelled_at ? t('print.order_cancelled_at', { at: formatDateTime(j.cancelled_at) })
    : j.due_at && j.is_open ? t('print.due', { at: formatShortDate(j.due_at) })
    : null;

  const payTone = j?.payment_status === 'paid' ? { bg: colors.successLight, fg: colors.successText }
    : j?.payment_status === 'claimed' ? { bg: colors.brandTint, fg: colors.brand }
    : { bg: colors.warningLight, fg: colors.warningText };

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
              <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md }} />
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
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
                  ) : [j.shop.address, j.shop.city].filter(Boolean).length ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{[j.shop.address, j.shop.city].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </Surface>

          <Surface id="teacher.print_job.spec">
            <Section icon="document" title={t('print.order_spec_title')} tint={{ bg: colors.brandTint, fg: colors.brand }}>
              {j.file_name ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md }}>
                  <Icon name="document" size={15} color={colors.textTertiary} />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{j.file_name}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Stat value={formatNumber(j.copies)} label={t('print.copies_label')} />
                <Stat value={formatNumber(j.pages)} label={t('print.order_file_pages')} />
                <Stat value={formatNumber(j.copies * j.pages)} label={t('print.order_printed')} />
              </View>
              {specTags(j, options.data, t).length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
                  {specTags(j, options.data, t).map((x, i) => <Tag key={i} text={x.text} icon={x.icon} tone={x.tone} />)}
                </View>
              ) : null}
              {j.course ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
                  <Icon name="sessions" size={15} color={colors.textTertiary} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('print.course')}</Text>
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }} numberOfLines={1}>{j.course.name}</Text>
                </View>
              ) : null}
            </Section>
          </Surface>

          <Surface id="teacher.print_job.money" assistantNeeds="teacher">
            <Section icon="money" title={t('print.money')} tint={{ bg: colors.successLight, fg: colors.successText }}
              end={j.payment_label ? (
                <View style={{ paddingHorizontal: 10, height: 26, borderRadius: radius.full, backgroundColor: payTone.bg, justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: payTone.fg }}>{j.payment_label}</Text>
                </View>
              ) : undefined}>
              <Row label={t('print.line_pages', { copies: formatNumber(j.copies), pages: formatNumber(j.pages), p: formatNumber(j.price_per_page, { maximumFractionDigits: 2 }) })} value={money(j.pages * j.copies * j.price_per_page)} />
              {(j.discount ?? 0) > 0 ? <Row label={t('print.line_discount_plain')} value={`− ${money(j.discount ?? 0)}`} /> : null}
              {j.finish_per_copy > 0 ? <Row label={t('print.line_finish', { copies: formatNumber(j.copies), p: formatNumber(j.finish_per_copy, { maximumFractionDigits: 2 }) })} value={money(j.copies * j.finish_per_copy)} /> : null}
              {(j.extras ?? []).map((x) => <Row key={x.id} label={x.name} value={money(x.amount)} />)}
              {(j.rush_fee ?? 0) > 0 ? <Row label={t('print.line_rush_plain')} value={money(j.rush_fee ?? 0)} /> : null}
              {j.delivery_fee > 0 ? <Row label={t('print.line_delivery')} value={money(j.delivery_fee)} /> : null}
              {j.platform_fee > 0 ? <Row label={t('print.line_fee')} value={money(j.platform_fee)} /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.successLight }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.successText }}>{t('print.total')}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: colors.successText }}>{money(j.total)}</Text>
              </View>
            </Section>
          </Surface>

          {j.status !== 'cancelled' && j.status !== 'declined' ? (
            <Surface id="teacher.print_job.payment" assistantNeeds="teacher">
            <FormCard icon="invoices" title={t('print.pay_title')} hint={j.payment_status === 'paid' ? t('print.paid_hint') : j.payment_status === 'claimed' ? t('print.claimed_hint') : t('print.pay_hint')} tint={j.payment_status === 'paid' ? colors.success : colors.warning}>
              {j.payment_status !== 'paid' ? (
                <>
                  {payTo?.instapay?.number || payTo?.vodafone_cash ? (
                    <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 4, borderWidth: 1, borderColor: colors.borderLight }}>
                      {payTo?.instapay?.number ? <Row label={t('print.pay_instapay')} value={payTo.instapay.name ? `${payTo.instapay.number} (${payTo.instapay.name})` : payTo.instapay.number} /> : null}
                      {payTo?.vodafone_cash ? <Row label={t('print.pay_vodafone')} value={payTo.vodafone_cash} /> : null}
                    </View>
                  ) : null}
                  <View style={{ marginTop: spacing.sm }}>
                    <Field label={t('print.method')} first><Chips options={[{ key: 'instapay', label: 'إنستاباي' }, { key: 'vodafone_cash', label: 'فودافون كاش' }, { key: 'bank', label: 'تحويل بنكي' }, { key: 'cash', label: 'نقدًا' }]} value={method} onChange={(k) => setMethod(String(k))} /></Field>
                    <Field label={t('print.reference')}><Input value={reference} onChangeText={setReference} placeholder={t('print.reference_ph')} maxLength={60} /></Field>
                    <Field label={t('print.proof')}>
                      <Button title={proofUri ? t('print.proof_picked') : t('print.proof_pick')} onPress={pickProof} variant="outline" />
                    </Field>
                    <Button title={t('print.claim')} onPress={claim} loading={busy} style={{ marginTop: spacing.sm }} />
                  </View>
                </>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="success" size={20} color={colors.successText} />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.successText }}>{t('print.paid_line', { amount: formatNumber(j.total, { maximumFractionDigits: 2 }), egp })}</Text>
                </View>
              )}
            </FormCard>
            </Surface>
          ) : null}

          {j.can_receive ? (
            <Surface id="teacher.print_job.receive" assistantNeeds="teacher">
            <FormCard icon="success" title={t('print.receive_title')} hint={t('print.rate_hint')} tint={colors.success}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={`${n}/5`} style={{ padding: 4 }}>
                    <Icon name="star" size={34} color={rating != null && n <= rating ? colors.warning : colors.border} />
                  </TouchableOpacity>
                ))}
              </View>
              <Input value={review} onChangeText={setReview} placeholder={t('print.review_ph')} maxLength={300} multiline />
              <Button title={t('print.confirm_receive')} onPress={receive} loading={busy} variant="success" style={{ marginTop: spacing.sm }} />
            </FormCard>
            </Surface>
          ) : j.status === 'received' && j.rating != null ? (
            <Surface id="teacher.print_job.receive" assistantNeeds="teacher">
              <Section icon="star" title={t('print.order_your_rating')} tint={{ bg: colors.warningLight, fg: colors.warningText }}>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" size={22} color={n <= (j.rating ?? 0) ? colors.warning : colors.border} />)}
                </View>
                {j.review ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: spacing.sm }}>{j.review}</Text> : null}
              </Section>
            </Surface>
          ) : null}

          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {!j.is_open ? <Surface id="teacher.print_job.reorder_button" assistantNeeds="teacher"><Button title={t('print.reorder')} onPress={reorder} variant="accent" loading={busy} /></Surface> : null}
            {j.can_cancel ? <Surface id="teacher.print_job.cancel_button" assistantNeeds="teacher"><Button title={t('print.cancel')} onPress={cancel} variant="outline" loading={busy} /></Surface> : null}
          </View>
        </>
      ) : null}
    </FormScreen>
    </Surface>
  );
}
