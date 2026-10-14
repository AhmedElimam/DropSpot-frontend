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
import { FormScreen, FormCard, Field, Input, Chips, Banner } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { formatNumber, formatShortDate } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import {
  getPrintJob, getPrintOptions, cancelPrintJob, receivePrintJob, reorderPrintJob, claimPrintPayment, PRINT_FLOW, type PrintJob,
} from '@/api/print';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: strong ? fonts.bold : fonts.medium, fontSize: strong ? 17 : 13.5, color: colors.textPrimary }}>{value}</Text>
    </View>
  );
}

/** The job's walk: a dot per step, filled up to where it stands. */
function Walk({ j }: { j: PrintJob }) {
  const { t } = useTranslation();
  const idx = PRINT_FLOW.indexOf(j.status);
  const stopped = j.status === 'declined' || j.status === 'cancelled';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
      {PRINT_FLOW.map((s, i) => {
        const done = !stopped && i < idx;
        const now = !stopped && i === idx;
        return (
          <View key={s} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : done || now ? colors.success : colors.border }} />
              <View style={{ width: now ? 16 : 12, height: now ? 16 : 12, borderRadius: 8, backgroundColor: done ? colors.success : now ? colors.brand : colors.border }} />
              <View style={{ flex: 1, height: 2, backgroundColor: i === PRINT_FLOW.length - 1 ? 'transparent' : done ? colors.success : colors.border }} />
            </View>
            <Text style={{ fontFamily: now ? fonts.bold : fonts.medium, fontSize: 10, color: now ? colors.brand : done ? colors.successText : colors.textTertiary, marginTop: 4 }} numberOfLines={1}>{t(`print.step_${s}`)}</Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * One print job: where it stands, the shop, the money, and the two things only the
 * teacher can do — tell the platform it was paid, and confirm the prints are in hand.
 */
export default function PrintJobScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const job = useQuery({ queryKey: ['print-job', id], queryFn: () => getPrintJob(id), enabled: !!id, refetchInterval: 30000 });
  const options = useQuery({ queryKey: ['print-options'], queryFn: getPrintOptions });
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
  const tone = j ? ({ warning: colors.warningText, info: colors.brand, success: colors.successText, danger: colors.dangerText, gray: colors.textSecondary } as const)[j.status_tone] : colors.textSecondary;

  return (
    <Surface id="screen.teacher.print_job" screen>
    <FormScreen title={j?.title ?? t('print.job')} subtitle={j ? t('print.copies_x_pages', { copies: formatNumber(j.copies), pages: formatNumber(j.pages) }) + ' · ' + j.spec_label : null} loading={job.isLoading}>
      {j ? (
        <>
          <Surface id="teacher.print_job.status">
          <FormCard icon="print" title={j.status_label} tint={tone}>
            <Walk j={j} />
            {j.status === 'declined' && j.decline_reason ? <View style={{ marginTop: spacing.sm }}><Banner tone="danger" text={t('print.declined_reason', { reason: j.decline_reason })} /></View> : null}
            {j.due_at && j.is_open && j.status !== 'sent' ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.sm }}>{t('print.due', { at: formatShortDate(j.due_at) })}</Text> : null}
            {j.status === 'sent' ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.sm }}>{t('print.sent_hint')}</Text> : null}
          </FormCard>
          </Surface>

          <Surface id="teacher.print_job.shop">
          <FormCard icon="storefront" title={j.shop.name ?? t('print.shop')} tint={colors.accent}
            action={j.shop.phone ? (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${j.shop.phone}`)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.full, backgroundColor: colors.accentLight }}>
                <Icon name="call" size={16} color={colors.accentText} /><Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.accentText }}>{t('print.call')}</Text>
              </TouchableOpacity>
            ) : undefined}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary }}>
              {j.spec.delivery_mode === 'deliver' ? t('print.deliver_to', { address: j.delivery_address ?? '' }) : [t('print.pickup_at'), j.shop.address, j.shop.city].filter(Boolean).join(' · ')}
            </Text>
          </FormCard>
          </Surface>

          <Surface id="teacher.print_job.money">
          <FormCard icon="money" title={t('print.money')} tint={colors.success}>
            <Row label={t('print.line_pages', { copies: formatNumber(j.copies), pages: formatNumber(j.pages), p: formatNumber(j.price_per_page, { maximumFractionDigits: 2 }) })} value={`${formatNumber(j.pages * j.copies * j.price_per_page, { maximumFractionDigits: 2 })} ${egp}`} />
            {(j.discount ?? 0) > 0 ? <Row label={t('print.line_discount_plain')} value={`− ${formatNumber(j.discount ?? 0, { maximumFractionDigits: 2 })} ${egp}`} /> : null}
            {j.finish_per_copy > 0 ? <Row label={t('print.line_finish', { copies: formatNumber(j.copies), p: formatNumber(j.finish_per_copy, { maximumFractionDigits: 2 }) })} value={`${formatNumber(j.copies * j.finish_per_copy, { maximumFractionDigits: 2 })} ${egp}`} /> : null}
            {(j.rush_fee ?? 0) > 0 ? <Row label={t('print.line_rush_plain')} value={`${formatNumber(j.rush_fee ?? 0, { maximumFractionDigits: 2 })} ${egp}`} /> : null}
            {j.delivery_fee > 0 ? <Row label={t('print.line_delivery')} value={`${formatNumber(j.delivery_fee, { maximumFractionDigits: 2 })} ${egp}`} /> : null}
            {j.platform_fee > 0 ? <Row label={t('print.line_fee')} value={`${formatNumber(j.platform_fee, { maximumFractionDigits: 2 })} ${egp}`} /> : null}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <Row label={t('print.total')} value={`${formatNumber(j.total, { maximumFractionDigits: 2 })} ${egp}`} strong />
          </FormCard>
          </Surface>

          {j.status !== 'cancelled' && j.status !== 'declined' ? (
            <Surface id="teacher.print_job.payment">
            <FormCard icon="invoices" title={t('print.pay_title')} hint={j.payment_status === 'paid' ? t('print.paid_hint') : j.payment_status === 'claimed' ? t('print.claimed_hint') : t('print.pay_hint')} tint={j.payment_status === 'paid' ? colors.success : colors.warning}>
              {j.payment_status !== 'paid' ? (
                <>
                  {payTo?.instapay?.number ? <Row label={t('print.pay_instapay')} value={`${payTo.instapay.number} · ${payTo.instapay.name}`} /> : null}
                  {payTo?.vodafone_cash ? <Row label={t('print.pay_vodafone')} value={payTo.vodafone_cash} /> : null}
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
                <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.successText }}>{t('print.paid_line', { amount: formatNumber(j.total, { maximumFractionDigits: 2 }), egp })}</Text>
              )}
            </FormCard>
            </Surface>
          ) : null}

          {j.can_receive ? (
            <Surface id="teacher.print_job.receive">
            <FormCard icon="success" title={t('print.receive_title')} hint={t('print.rate_hint')} tint={colors.success}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={`${n}/5`} style={{ padding: 4 }}>
                    <Icon name="star" size={30} color={rating != null && n <= rating ? colors.warning : colors.border} />
                  </TouchableOpacity>
                ))}
              </View>
              <Input value={review} onChangeText={setReview} placeholder={t('print.review_ph')} maxLength={300} multiline />
              <Button title={t('print.confirm_receive')} onPress={receive} loading={busy} style={{ marginTop: spacing.sm }} />
            </FormCard>
            </Surface>
          ) : null}

          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {j.can_cancel ? <Surface id="teacher.print_job.cancel_button"><Button title={t('print.cancel')} onPress={cancel} variant="outline" loading={busy} /></Surface> : null}
            {!j.is_open ? <Surface id="teacher.print_job.reorder_button"><Button title={t('print.reorder')} onPress={reorder} variant="outline" loading={busy} /></Surface> : null}
          </View>
        </>
      ) : null}
    </FormScreen>
    </Surface>
  );
}
