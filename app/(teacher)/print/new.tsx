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
import { ShopLogo } from '@/components/print/ShopLogo';
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
import { PlacePicker, type PickedPlace } from '@/components/print/PlacePicker';

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
  const [spec, setSpec] = useState<PrintSpec>({ paper: '80', ink: 'bw', sides: 1, finish: 'none', delivery_mode: 'pickup', size: 'A4', rush: false, extras: [] });
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);

  const o = options.data;
  const s = shop.data;
  // Which branch prints it, for a pickup (founder 2026-10-14: shops have branches) — the
  // nearest by default; a delivery leaves from the branch nearest the pin (the server picks).
  const [branchId, setBranchId] = useState<number | null>(null);
  const branches = s?.branches ?? [];
  const branchPicked = branchId ?? branches[0]?.id ?? null;
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
      extras: (spec.extras ?? []).filter((id) => (s?.extras ?? []).some((x) => x.id === id)),
    };
    if (JSON.stringify(next) !== JSON.stringify(spec)) setSpec(next);
  }, [choices, spec, s?.rush, s?.extras]);

  const toggleExtra = (id: number) => setSpec({ ...spec, extras: (spec.extras ?? []).includes(id) ? (spec.extras ?? []).filter((x) => x !== id) : [...(spec.extras ?? []), id] });

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
    if (spec.delivery_mode === 'deliver' && !place) { setPicking(true); return; }
    setSending(true);
    try {
      const deliver = spec.delivery_mode === 'deliver' && place;
      const job = await createPrintJob({ upload: upload.upload, vendor_id: s.vendor_id, copies: copiesN, title: title.trim() || undefined, course_id: courseId,
        delivery_address: deliver ? [place!.address, place!.details].filter(Boolean).join(' — ') : null,
        dest_lat: deliver ? place!.lat : null, dest_lng: deliver ? place!.lng : null, dest_name: deliver ? place!.name : null,
        branch_id: !deliver && branches.length > 1 ? branchPicked : null, ...spec });
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
            <ShopLogo logo={s.logo} size={46} premium={s.quality_tier === 'premium'} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.successLight, borderRadius: radius.lg, padding: spacing.md }}>
                <View style={{ width: 46, height: 56, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="document" size={22} color={colors.danger} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.danger, marginTop: 1 }}>PDF</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={2}>{upload.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.successText }}>{t('print.pages_n', { n: formatNumber(upload.pages) })}</Text>
                    <View style={{ width: 1, height: 12, backgroundColor: colors.border }} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{formatNumber(upload.size / 1048576, { maximumFractionDigits: 1 })} {t('print.mb')}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={pickPdf} disabled={uploading} accessibilityRole="button" style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: colors.surface, justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('print.change_file')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={pickPdf} disabled={uploading} activeOpacity={0.85} accessibilityRole="button"
                style={{ alignItems: 'center', gap: 6, paddingVertical: spacing.xl, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.brand, backgroundColor: colors.brandTint }}>
                {uploading ? <ActivityIndicator size="large" color={colors.brand} /> : (
                  <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="download" size={26} color={colors.onPrimary} />
                  </View>
                )}
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>{uploading ? t('print.uploading') : t('print.pick_pdf')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('print.pick_pdf_hint')}</Text>
              </TouchableOpacity>
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
                <Field label={t('print.size')} first><Chips options={choices.sizes.map((c) => ({ key: c.key, label: c.key === 'A4' ? 'A4' : `${c.key} (×${money(Number(s.size_factors?.[c.key] ?? 1))})` }))} value={spec.size ?? 'A4'} onChange={(k) => setSpec({ ...spec, size: String(k) })} /></Field>
              ) : null}
              <Field label={t('print.paper')} first={choices.sizes.length <= 1}><Chips options={priced(choices.papers, (k) => rateOf(k, spec.ink, spec.sides))} value={spec.paper} onChange={(k) => setSpec({ ...spec, paper: String(k) })} /></Field>
              <Field label={t('print.ink')}><Chips options={priced(choices.inks, (k) => rateOf(spec.paper, k, spec.sides))} value={spec.ink} onChange={(k) => setSpec({ ...spec, ink: String(k) })} /></Field>
              <Field label={t('print.sides')}><Chips options={priced(choices.sides, (k) => rateOf(spec.paper, spec.ink, Number(k)))} value={String(spec.sides)} onChange={(k) => setSpec({ ...spec, sides: Number(k) })} /></Field>
              <Field label={t('print.finish')}><Chips options={priced(choices.finishes, (k) => s.menu.finishes.find((f) => f.kind === k)?.price_per_copy ?? null, '+')} value={spec.finish} onChange={(k) => setSpec({ ...spec, finish: String(k) })} /></Field>
              <Field label={t('print.delivery')}><Chips options={priced(choices.delivery_modes, (k) => (k === 'deliver' ? s.delivery_fee : 0), '+')} value={spec.delivery_mode} onChange={(k) => setSpec({ ...spec, delivery_mode: k as PrintSpec['delivery_mode'] })} tint={colors.accent} /></Field>
              {spec.delivery_mode !== 'deliver' && branches.length > 1 ? (
                <Field label={t('print.pickup_branch')}>
                  <Chips options={branches.map((b) => ({ key: b.id, label: b.distance_km != null ? `${b.name} (${t('print.km_away', { km: formatNumber(b.distance_km, { maximumFractionDigits: 1 }) })})` : b.name }))}
                    value={branchPicked ?? undefined} onChange={(k) => setBranchId(Number(k))} tint={colors.accent} />
                </Field>
              ) : null}
              {s.rush ? (
                <Field label={t('print.speed')}>
                  <Chips options={[{ key: 'normal', label: t('print.speed_normal', { h: formatNumber(s.turnaround_hours) }) }, { key: 'rush', label: t('print.speed_rush', { h: formatNumber(s.rush.hours), p: formatNumber(s.rush.pct) }) }]}
                    value={spec.rush ? 'rush' : 'normal'} onChange={(k) => setSpec({ ...spec, rush: k === 'rush' })} tint={colors.warning} />
                </Field>
              ) : null}
              {spec.delivery_mode === 'deliver' ? (
                <Field label={t('print.dest')} required>
                  <TouchableOpacity onPress={() => setPicking(true)} activeOpacity={0.88} accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5, borderColor: place ? colors.success : colors.accent, borderStyle: place ? 'solid' : 'dashed', padding: spacing.md, backgroundColor: place ? colors.successLight : colors.accentLight }}>
                    <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: place ? colors.success : colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="location" size={20} color={colors.onPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      {place ? (
                        <>
                          {place.name ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.successText }}>{place.name}</Text> : null}
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }} numberOfLines={2}>{place.address}</Text>
                          {place.details ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{place.details}</Text> : null}
                        </>
                      ) : (
                        <>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accentText }}>{t('print.pick_open')}</Text>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{t('print.dest_hint')}</Text>
                        </>
                      )}
                    </View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{place ? t('print.change_shop') : ''}</Text>
                  </TouchableOpacity>
                </Field>
              ) : null}
              {(s.extras ?? []).length ? (
                <Field label={t('print.extras')} hint={t('print.extras_hint')}>
                  {(s.extras ?? []).map((x) => {
                    const on = (spec.extras ?? []).includes(x.id);
                    return (
                      <TouchableOpacity key={x.id} onPress={() => toggleExtra(x.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} activeOpacity={0.85}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                        <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {on ? <Icon name="success" size={14} color={colors.onPrimary} /> : null}
                        </View>
                        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary }}>{x.name}</Text>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary }}>+{money(x.price)} <Text style={{ fontFamily: fonts.regular, color: colors.textTertiary }}>{x.unit_label}</Text></Text>
                      </TouchableOpacity>
                    );
                  })}
                </Field>
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
                  {(quote.extras ?? []).map((x) => <Line key={x.id} label={x.name} value={money(x.amount)} egp={egp} />)}
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
                        {x.rating != null ? <><View style={{ width: 1, height: 10, backgroundColor: colors.border, marginHorizontal: 2 }} /><Icon name="star" size={11} color={colors.warning} /><Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{formatNumber(x.rating, { maximumFractionDigits: 1 })}</Text></> : null}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <ShopLogo logo={s.logo} size={36} premium={s.quality_tier === 'premium'} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('print.total')}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }} numberOfLines={1}>{t('print.copies_x_pages', { copies: formatNumber(copiesN), pages: formatNumber(pages) })}</Text>
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }}>{money(quote?.total ?? 0)} <Text style={{ fontSize: 13, color: colors.textSecondary }}>{egp}</Text></Text>
          </View>
          <Button title={t('print.send_to', { shop: s.name })} onPress={send} loading={sending} />
        </View>
        </Surface>
      ) : null}
      <PlacePicker visible={picking} onClose={() => setPicking(false)} onPick={setPlace} mapsKey={o?.maps_key} venues={o?.destinations ?? []} initial={place} />
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
