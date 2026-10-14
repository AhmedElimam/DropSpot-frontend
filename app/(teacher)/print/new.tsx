import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Alert } from '@/ui/dialog';
import { router, type Href } from 'expo-router';
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
import { formatNumber } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import {
  getPrintOptions, uploadPrintFile, getPrintBoard, createPrintJob,
  type PrintUpload, type PrintSpec, type BoardShop,
} from '@/api/print';

const BADGE_TINT = (): Record<string, { bg: string; fg: string }> => ({
  cheapest: { bg: colors.successLight, fg: colors.successText },
  fastest: { bg: colors.brandTint, fg: colors.brand },
  nearest: { bg: colors.accentLight, fg: colors.accentText },
  top_rated: { bg: colors.warningLight, fg: colors.warningText },
});

function Stars({ n }: { n: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={12} color={i <= Math.round(n) ? colors.warning : colors.border} />)}
    </View>
  );
}

/** One shop on the board: who, how good, how fast, and the total for THIS job. */
function ShopCard({ s, selected, onPress, badgeLabels, egp }: { s: BoardShop; selected: boolean; onPress: () => void; badgeLabels: Record<string, string>; egp: string }) {
  const { t } = useTranslation();
  const ok = s.quote.ok;
  const tints = BADGE_TINT();
  return (
    <TouchableOpacity onPress={onPress} disabled={!ok} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected, disabled: !ok }}
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.brand : colors.border, padding: spacing.md, marginBottom: spacing.sm, opacity: ok ? 1 : 0.55 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: selected ? colors.brand : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="storefront" size={22} color={selected ? colors.onPrimary : colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
            {s.badges.map((b) => (
              <View key={b} style={{ backgroundColor: tints[b]?.bg ?? colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: tints[b]?.fg ?? colors.textSecondary }}>{badgeLabels[b] ?? b}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
            {[s.city, s.quality_label, s.ink_tech_label, t('print.within_hours', { h: formatNumber(s.turnaround_hours) }), s.distance_km != null ? t('print.km_away', { km: formatNumber(s.distance_km, { maximumFractionDigits: 1 }) }) : null].filter(Boolean).join(' · ')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' }}>
            {s.rating != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Stars n={s.rating} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('print.rating', { r: formatNumber(s.rating, { maximumFractionDigits: 1 }), n: formatNumber(s.ratings) })}</Text>
              </View>
            ) : <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('print.no_rating')}</Text>}
            {s.on_time_pct != null ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('print.on_time', { p: formatNumber(s.on_time_pct) })}</Text> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {ok ? (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary }}>{formatNumber(s.quote.total ?? 0, { maximumFractionDigits: 2 })}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{egp} · {formatNumber(s.quote.price_per_page ?? 0, { maximumFractionDigits: 2 })}/{t('print.page')}</Text>
            </>
          ) : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.dangerText, maxWidth: 110, textAlign: 'left' }}>{s.quote.reason}</Text>
          )}
        </View>
      </View>
      {s.notes ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }} numberOfLines={2}>{s.notes}</Text> : null}
    </TouchableOpacity>
  );
}

/**
 * «طلب طباعة» — one screen: the file, the count, the spec, and under them every live shop
 * priced for exactly that. Change a chip and every total moves; pick a shop and send.
 */
export default function PrintNew() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const options = useQuery({ queryKey: ['print-options'], queryFn: getPrintOptions });
  const { data: courses } = useCourses();

  const [upload, setUpload] = useState<PrintUpload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [copies, setCopies] = useState('1');
  const [spec, setSpec] = useState<PrintSpec>({ paper: '80', ink: 'bw', sides: 1, finish: 'none', delivery_mode: 'pickup' });
  const [address, setAddress] = useState('');
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const copiesN = Math.max(0, parseInt(copies || '0', 10) || 0);
  const rosterOf = (id: string | null) => (courses ?? []).find((c) => c.id === id)?.students_count ?? null;

  const board = useQuery({
    queryKey: ['print-board', upload?.upload, copiesN, spec],
    queryFn: () => getPrintBoard({ upload: upload!.upload, copies: copiesN, ...spec }),
    enabled: !!upload && copiesN > 0,
    placeholderData: (prev) => prev,
  });
  const shops = board.data?.shops ?? [];
  const chosen = useMemo(() => shops.find((s) => s.vendor_id === vendorId) ?? null, [shops, vendorId]);
  // A spec change can take the chosen shop off the able list: drop it rather than send a refused quote.
  useEffect(() => { if (vendorId && chosen && !chosen.quote.ok) setVendorId(null); }, [chosen, vendorId]);

  const pickPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const up = await uploadPrintFile({ uri: a.uri, name: a.name ?? 'file.pdf' });
      setUpload(up);
      if (!title) setTitle(up.name.replace(/\.pdf$/i, ''));
      setVendorId(null);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('print.upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  const chooseCourse = (id: string) => {
    setCourseId(id);
    const n = rosterOf(id);
    if (n && n > 0) setCopies(String(n));
  };

  const send = async () => {
    if (!upload || !chosen || sending) return;
    if (spec.delivery_mode === 'deliver' && !address.trim()) { Alert.alert('', t('print.address_required')); return; }
    setSending(true);
    try {
      const job = await createPrintJob({ upload: upload.upload, vendor_id: chosen.vendor_id, copies: copiesN, title: title.trim() || undefined, course_id: courseId, delivery_address: address.trim() || null, ...spec });
      qc.invalidateQueries({ queryKey: ['print-jobs'] });
      router.replace(`/(teacher)/print/${job.id}` as Href);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('print.send_failed'));
    } finally {
      setSending(false);
    }
  };

  const o = options.data;
  const egp = t('teacher.egp');
  const chip = (list: { key: string; label: string }[] | undefined) => (list ?? []).map((c) => ({ key: c.key, label: c.label }));

  return (
    <Surface id="screen.teacher.print_new" screen>
    <FormScreen title={t('print.new_title')} subtitle={t('print.new_sub')} loading={options.isLoading}
      contentStyle={{ paddingBottom: nav.pageEnd + insets.bottom + 96 }}>
      {o && o.live_shops === 0 ? <Banner tone="warn" text={t('print.no_shops')} /> : null}

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
          <Field label={t('print.copies_label')}>
            <NumberInput value={copies} onChangeText={setCopies} suffix={t('print.copy_unit')} />
          </Field>
        </View>
      </FormCard>
      </Surface>

      {/* 3 · the spec — every chip re-prices the whole board */}
      <Surface id="teacher.print_new.spec">
      <FormCard icon="settings" title={t('print.spec')} tint={colors.brand}>
        <Field label={t('print.paper')} first><Chips options={chip(o?.papers)} value={spec.paper} onChange={(k) => setSpec({ ...spec, paper: String(k) })} /></Field>
        <Field label={t('print.ink')}><Chips options={chip(o?.inks)} value={spec.ink} onChange={(k) => setSpec({ ...spec, ink: String(k) })} /></Field>
        <Field label={t('print.sides')}><Chips options={chip(o?.sides)} value={String(spec.sides)} onChange={(k) => setSpec({ ...spec, sides: Number(k) })} /></Field>
        <Field label={t('print.finish')}><Chips options={chip(o?.finishes)} value={spec.finish} onChange={(k) => setSpec({ ...spec, finish: String(k) })} /></Field>
        <Field label={t('print.delivery')}><Chips options={chip(o?.delivery_modes)} value={spec.delivery_mode} onChange={(k) => setSpec({ ...spec, delivery_mode: k as PrintSpec['delivery_mode'] })} tint={colors.accent} /></Field>
        {spec.delivery_mode === 'deliver' ? (
          <Field label={t('print.address')} required><Input value={address} onChangeText={setAddress} placeholder={t('print.address_ph')} multiline maxLength={300} /></Field>
        ) : null}
      </FormCard>
      </Surface>

      {/* 4 · the board */}
      <Surface id="teacher.print_new.board">
      <View style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Icon name="pricetag" size={18} color={colors.accent} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, flex: 1 }}>{t('print.board_title')}</Text>
          {board.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>
        {!upload ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('print.board_needs_file')}</Text>
        ) : copiesN === 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('print.board_needs_copies')}</Text>
        ) : board.isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : shops.length === 0 ? (
          <Banner tone="warn" text={t('print.no_shops')} />
        ) : (
          <>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginBottom: spacing.sm }}>
              {t('print.board_hint', { pages: formatNumber(board.data?.pages ?? 0), copies: formatNumber(copiesN), printed: formatNumber((board.data?.pages ?? 0) * copiesN) })}
            </Text>
            {shops.map((s) => (
              <Surface key={s.vendor_id} id="teacher.print_new.board.shop" ctx={{ shop: s }}>
                <ShopCard s={s} selected={vendorId === s.vendor_id} onPress={() => setVendorId(s.vendor_id)} badgeLabels={o?.badges ?? {}} egp={egp} />
              </Surface>
            ))}
            {o?.platform_fee_on ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('print.fee_note', { p: formatNumber(o.platform_fee_piastres) })}</Text> : null}
          </>
        )}
      </View>
      </Surface>

      {/* send */}
      {chosen && chosen.quote.ok ? (
        <Surface id="teacher.print_new.send">
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('print.total')}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{formatNumber(chosen.quote.total ?? 0, { maximumFractionDigits: 2 })} {egp}</Text>
          </View>
          <Button title={t('print.send_to', { shop: chosen.name })} onPress={send} loading={sending} />
        </View>
        </Surface>
      ) : null}
    </FormScreen>
    </Surface>
  );
}
