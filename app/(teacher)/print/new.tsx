import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Alert } from '@/ui/dialog';
import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { FormScreen, FormCard, Field, Input, NumberInput, Chips, Banner } from '@/components/ui/Form';
import { SelectField } from '@/components/ui/SelectField';
import { Button } from '@/components/ui/Button';
import { useCourses } from '@/hooks/useCourses';
import { formatNumber, formatDateTime } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import {
  getPrintOptions, getPrintShop, uploadPrintFile, getPrintBoard, createPrintJob, quoteOnMenu, menuChoices,
  type PrintUpload, type PrintSpec, type Choice,
} from '@/api/print';
import { Stars, SpeedLine } from './shops/index';

const money = (v: number) => formatNumber(v, { maximumFractionDigits: 2 });

/**
 * «طلب طباعة» — built on ONE shop's menu (shop first, founder 2026-10-14). The composer
 * arrives with the chosen shop; every chip is a choice that shop actually offers, with its
 * price on it; every tap re-prices on the phone from the shop's own card. Under the sum a
 * strip shows what the same job costs at the other shops — one tap switches, keeping the
 * file and the spec. The server re-runs the arithmetic at send and locks that.
 */
export default function PrintNew() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { vendor } = useLocalSearchParams<{ vendor?: string }>();
  const options = useQuery({ queryKey: ['print-options'], queryFn: getPrintOptions });
  const shop = useQuery({ queryKey: ['print-shop', vendor], queryFn: () => getPrintShop(vendor!), enabled: !!vendor });
  const { data: courses } = useCourses();

  const [upload, setUpload] = useState<PrintUpload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [copies, setCopies] = useState('1');
  const [spec, setSpec] = useState<PrintSpec>({ paper: '80', ink: 'bw', sides: 1, finish: 'none', delivery_mode: 'pickup', size: 'A4', rush: false });
  const [address, setAddress] = useState('');
  const [sending, setSending] = useState(false);

  const o = options.data;
  const s = shop.data;
  const copiesN = Math.max(0, parseInt(copies || '0', 10) || 0);
  const pages = upload?.pages ?? 0;
  const egp = t('teacher.egp');

  // Only what THIS shop offers is on the table; a spec the shop lacks snaps to its first choice.
  const choices = useMemo(() => (s && o ? menuChoices(s, o) : null), [s, o]);
  useEffect(() => {
    if (!choices) return;
    const pick = <K extends string>(list: Choice[], cur: K): K => (list.some((c) => c.key === cur) ? cur : (list[0]?.key as K) ?? cur);
    const next: PrintSpec = {
      paper: pick(choices.papers, spec.paper),
      ink: pick(choices.inks, spec.ink),
      sides: Number(pick(choices.sides, String(spec.sides))),
      finish: pick(choices.finishes, spec.finish),
      delivery_mode: pick(choices.delivery_modes, spec.delivery_mode) as PrintSpec['delivery_mode'],
      size: pick(choices.sizes, spec.size ?? 'A4'),
      rush: !!spec.rush && !!s?.rush,
    };
    if (JSON.stringify(next) !== JSON.stringify(spec)) setSpec(next);
  }, [choices, spec, s?.rush]);

  // The live sum — the shop's own arithmetic, on the phone, on every tap.
  const quote = useMemo(() => (s && o ? quoteOnMenu(s, pages, copiesN, spec, { on: o.platform_fee_on, piastres: o.platform_fee_piastres }) : null), [s, o, pages, copiesN, spec]);
  const ready = !!upload && copiesN > 0 && !!quote?.ok;

  // The same job at the other shops — inDrive's «other offers» — once there is a job to price.
  const board = useQuery({
    queryKey: ['print-board', upload?.upload, copiesN, spec],
    queryFn: () => getPrintBoard({ upload: upload!.upload, copies: copiesN, ...spec }),
    enabled: !!upload && copiesN > 0,
    placeholderData: (prev) => prev,
  });
  const others = (board.data?.shops ?? []).filter((x) => x.vendor_id !== Number(vendor) && x.quote.ok);

  const pickPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const up = await uploadPrintFile({ uri: a.uri, name: a.name ?? 'file.pdf' });
      setUpload(up);
      if (!title) setTitle(up.name.replace(/\.pdf$/i, ''));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('print.upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  const chooseCourse = (id: string) => {
    setCourseId(id);
    const n = (courses ?? []).find((c) => c.id === id)?.students_count ?? null;
    if (n && n > 0) setCopies(String(n));
  };

  const send = async () => {
    if (!upload || !s || !ready || sending) return;
    if (spec.delivery_mode === 'deliver' && !address.trim()) { Alert.alert('', t('print.address_required')); return; }
    setSending(true);
    try {
      const job = await createPrintJob({ upload: upload.upload, vendor_id: s.vendor_id, copies: copiesN, title: title.trim() || undefined, course_id: courseId, delivery_address: address.trim() || null, ...spec });
      qc.invalidateQueries({ queryKey: ['print-jobs'] });
      qc.invalidateQueries({ queryKey: ['print-shops'] });
      router.replace(`/(teacher)/print/${job.id}` as Href);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('print.send_failed'));
    } finally {
      setSending(false);
    }
  };

  if (!vendor) return <Redirect href={'/(teacher)/print/shops' as Href} />;

  // A chip wears its price: «ورق ٨٠ جم · ٠٫٥٠» — the number for THAT choice with the rest as set.
  const rateOf = (paper: string, ink: string, sides: number) => s?.menu.rates.find((r) => r.paper === paper && r.ink === ink && r.sides === sides)?.price_per_page ?? null;
  const priced = (list: Choice[], price: (k: string) => number | null, prefix = '') => list.map((c) => {
    const p = price(c.key);
    return { key: c.key, label: p == null ? c.label : p === 0 ? c.label : `${c.label} · ${prefix}${money(p)}` };
  });
  const eta = quote?.ok && quote.turnaround_hours ? formatDateTime(new Date(Date.now() + quote.turnaround_hours * 3600_000)) : null;

  return (
    <Surface id="screen.teacher.print_new" screen>
    <FormScreen title={t('print.new_title')} subtitle={t('print.new_sub_shop')} loading={options.isLoading || shop.isLoading}
      contentStyle={{ paddingBottom: nav.pageEnd + insets.bottom + 110 }}>
      {!s ? <Banner tone="warn" text={t('print.shop_off')} /> : (
        <>
          {/* 0 · the shop you are ordering from */}
          <Surface id="teacher.print_new.shop">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandTint, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="storefront" size={21} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.brand }}>{t('print.building_on')}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
                {s.rating != null ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Stars n={s.rating} size={11} /><Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary }}>{formatNumber(s.rating, { maximumFractionDigits: 1 })}</Text></View> : null}
                <SpeedLine s={s} size={11.5} />
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push('/(teacher)/print/shops' as Href)} accessibilityRole="button" hitSlop={8}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('print.change_shop')}</Text>
            </TouchableOpacity>
          </View>
          </Surface>

          {/* 1 · the file */}
          <Surface id="teacher.print_new.file">
          <FormCard icon="document" title={t('print.file')} required tint={upload ? colors.success : colors.brand}>
            {upload ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon name="success" size={20} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{upload.name}</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('print.pages_n', { n: formatNumber(upload.pages) })} · {formatNumber(upload.size / 1048576, { maximumFractionDigits: 1 })} {t('print.mb')}</Text>
                </View>
                <TouchableOpacity onPress={pickPdf} disabled={uploading} accessibilityRole="button"><Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('print.change_file')}</Text></TouchableOpacity>
              </View>
            ) : (
              <Button title={uploading ? t('print.uploading') : t('print.pick_pdf')} onPress={pickPdf} loading={uploading} variant="outline" />
            )}
            <View style={{ marginTop: spacing.md }}>
              <Field label={t('print.title_label')}><Input value={title} onChangeText={setTitle} placeholder={t('print.title_ph')} maxLength={120} /></Field>
            </View>
          </FormCard>
          </Surface>

          {/* 2 · how many */}
          <Surface id="teacher.print_new.copies">
          <FormCard icon="children" title={t('print.copies')} hint={t('print.copies_hint')} tint={colors.accent}>
            <SelectField label={t('print.course')} placeholder={t('print.course_ph')} value={courseId}
              options={(courses ?? []).map((c) => ({ key: c.id, label: `${c.name} — ${t('form_ui.students_n', { n: formatNumber(c.students_count) })}` }))}
              onChange={chooseCourse} emptyHint={t('print.no_courses')} />
            <View style={{ marginTop: spacing.sm }}>
              <Field label={t('print.copies_label')} hint={s.min_copies > 1 ? t('print.min_copies_line', { n: formatNumber(s.min_copies) }) : undefined}>
                <NumberInput value={copies} onChangeText={setCopies} suffix={t('print.copy_unit')} />
              </Field>
            </View>
          </FormCard>
          </Surface>

          {/* 3 · the spec — only this shop's choices, each wearing its price */}
          {choices ? (
            <Surface id="teacher.print_new.spec">
            <FormCard icon="settings" title={t('print.spec')} hint={t('print.spec_hint')} tint={colors.brand}>
              {choices.sizes.length > 1 ? (
                <Field label={t('print.size')} first><Chips options={choices.sizes.map((c) => ({ key: c.key, label: c.key === 'A4' ? 'A4' : `${c.key} · ×${money(Number(s.size_factors?.[c.key] ?? 1))}` }))} value={spec.size ?? 'A4'} onChange={(k) => setSpec({ ...spec, size: String(k) })} /></Field>
              ) : null}
              <Field label={t('print.paper')} first={choices.sizes.length <= 1}><Chips options={priced(choices.papers, (k) => rateOf(k, spec.ink, spec.sides))} value={spec.paper} onChange={(k) => setSpec({ ...spec, paper: String(k) })} /></Field>
              <Field label={t('print.ink')}><Chips options={priced(choices.inks, (k) => rateOf(spec.paper, k, spec.sides))} value={spec.ink} onChange={(k) => setSpec({ ...spec, ink: String(k) })} /></Field>
              <Field label={t('print.sides')}><Chips options={priced(choices.sides, (k) => rateOf(spec.paper, spec.ink, Number(k)))} value={String(spec.sides)} onChange={(k) => setSpec({ ...spec, sides: Number(k) })} /></Field>
              <Field label={t('print.finish')}><Chips options={priced(choices.finishes, (k) => s.menu.finishes.find((f) => f.kind === k)?.price_per_copy ?? null, '+')} value={spec.finish} onChange={(k) => setSpec({ ...spec, finish: String(k) })} /></Field>
              <Field label={t('print.delivery')}><Chips options={priced(choices.delivery_modes, (k) => (k === 'deliver' ? s.delivery_fee : 0), '+')} value={spec.delivery_mode} onChange={(k) => setSpec({ ...spec, delivery_mode: k as PrintSpec['delivery_mode'] })} tint={colors.accent} /></Field>
              {s.rush ? (
                <Field label={t('print.speed')}>
                  <Chips options={[{ key: 'normal', label: t('print.speed_normal', { h: formatNumber(s.turnaround_hours) }) }, { key: 'rush', label: t('print.speed_rush', { h: formatNumber(s.rush.hours), p: formatNumber(s.rush.pct) }) }]}
                    value={spec.rush ? 'rush' : 'normal'} onChange={(k) => setSpec({ ...spec, rush: k === 'rush' })} tint={colors.warning} />
                </Field>
              ) : null}
              {spec.delivery_mode === 'deliver' ? (
                <Field label={t('print.address')} required><Input value={address} onChangeText={setAddress} placeholder={t('print.address_ph')} multiline maxLength={300} /></Field>
              ) : null}
              {quote && !quote.ok ? <View style={{ marginTop: spacing.md }}><Banner tone="warn" text={quote.reason === 'min_copies' ? t('print.min_copies_line', { n: formatNumber(s.min_copies) }) : quote.reason === 'paused' ? t('print.paused_banner', { at: formatDateTime(s.paused_until!) }) : t('print.not_on_menu')} style={{ marginBottom: 0 }} /></View> : null}
            </FormCard>
            </Surface>
          ) : null}

          {/* 4 · the live sum */}
          {quote?.ok ? (
            <Surface id="teacher.print_new.sum">
            <FormCard icon="pricetag" title={t('print.breakdown')} tint={colors.success}>
              {!upload || copiesN === 0 ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{!upload ? t('print.board_needs_file') : t('print.board_needs_copies')}</Text>
              ) : (
                <>
                  <Line label={t('print.line_pages', { copies: formatNumber(copiesN), pages: formatNumber(pages), p: money(quote.price_per_page ?? 0) })} value={money(quote.printing ?? pages * copiesN * (quote.price_per_page ?? 0))} egp={egp} />
                  {quote.discount ? <Line label={t('print.line_discount', { p: formatNumber(quote.discount_pct ?? 0) })} value={`− ${money(quote.discount)}`} egp={egp} tone={colors.successText} /> : null}
                  {quote.finish_per_copy ? <Line label={t('print.line_finish', { copies: formatNumber(copiesN), p: money(quote.finish_per_copy) })} value={money(copiesN * quote.finish_per_copy)} egp={egp} /> : null}
                  {quote.rush_fee ? <Line label={t('print.line_rush', { p: formatNumber(s.rush?.pct ?? 0) })} value={money(quote.rush_fee)} egp={egp} tone={colors.warningDark} /> : null}
                  {quote.delivery_fee ? <Line label={t('print.line_delivery')} value={money(quote.delivery_fee)} egp={egp} /> : null}
                  {quote.platform_fee ? <Line label={t('print.line_fee')} value={money(quote.platform_fee)} egp={egp} /> : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: 4 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('print.total')}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.successText }}>{money(quote.total ?? 0)} {egp}</Text>
                  </View>
                  {eta ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{t('print.eta', { at: eta })}</Text> : null}
                </>
              )}
            </FormCard>
            </Surface>
          ) : null}

          {/* 5 · the same job elsewhere */}
          {upload && copiesN > 0 && (others.length > 0 || board.isFetching) ? (
            <Surface id="teacher.print_new.compare">
            <View style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <Icon name="storefront" size={16} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, flex: 1 }}>{t('print.compare_title')}</Text>
                {board.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {others.map((x) => {
                  const d = Math.round(((x.quote.total ?? 0) - (quote?.total ?? 0)) * 100) / 100;
                  const tone = d < 0 ? colors.successText : d > 0 ? colors.textTertiary : colors.textSecondary;
                  return (
                    <TouchableOpacity key={x.vendor_id} onPress={() => router.setParams({ vendor: String(x.vendor_id) })} activeOpacity={0.85} accessibilityRole="button"
                      style={{ width: 150, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: d < 0 ? colors.success : colors.border, padding: spacing.sm }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{x.name}</Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginTop: 2 }}>{money(x.quote.total ?? 0)} <Text style={{ fontSize: 11, color: colors.textTertiary }}>{egp}</Text></Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: tone }}>{d < 0 ? t('print.compare_cheaper', { d: money(-d) }) : d > 0 ? t('print.compare_pricier', { d: money(d) }) : t('print.compare_same')}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Icon name="clock" size={11} color={colors.textTertiary} />
                        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{t('print.within_hours', { h: formatNumber(x.turnaround_hours) })}</Text>
                        {x.rating != null ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>· ★ {formatNumber(x.rating, { maximumFractionDigits: 1 })}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            </Surface>
          ) : null}
        </>
      )}

      {/* send */}
      {s && ready ? (
        <Surface id="teacher.print_new.send">
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('print.total')}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{money(quote?.total ?? 0)} {egp}</Text>
          </View>
          <Button title={t('print.send_to', { shop: s.name })} onPress={send} loading={sending} />
        </View>
        </Surface>
      ) : null}
    </FormScreen>
    </Surface>
  );
}

function Line({ label, value, egp, tone }: { label: string; value: string; egp: string; tone?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: tone ?? colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: tone ?? colors.textPrimary }}>{value} {egp}</Text>
    </View>
  );
}
