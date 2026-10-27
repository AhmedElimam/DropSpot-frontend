import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Share, KeyboardAvoidingView, Switch, ImageBackground } from 'react-native';
import { Alert } from '@/ui/dialog';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { PageHero } from '@/components/ui/PageHero';
import { GroupFilter, useGroupFilter } from '@/components/teacher/GroupFilter';
import { formatNumber } from '@/utils/format';
import { onWhite } from '@/theme/onWhite';
import { Icon, type IconName } from '@/components/ui/Icon';
import { RichTextEditor, type RichTextEditorRef } from '@/components/RichTextEditor';
import { useCourses } from '@/hooks/useCourses';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { mintInviteLink, type MintedInviteLink } from '@/api/invitation';
import { isNetworkFailure } from '@/db/marksSync';
import { getPaymentMethods, saveBookingTemplate, uploadBookingLinkImage, type BookingTemplate } from '@/api/paymentMethods';
import { isArabicName } from '@/utils/validators';
import { Surface } from '@/ui/surfaces';

/**
 * Invite-by-link (mobile parity for the web "رابط مُعبّأ" channel): the teacher picks
 * a course + student name, mints a single-use link, and shares it with the family —
 * who open it, confirm, and self-register into that course. No phone number needed.
 */
export default function InviteLink() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: courses, isLoading } = useCourses();

  const [courseId, setCourseId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [minted, setMinted] = useState<MintedInviteLink | null>(null);
  // Per-link booking options.
  const [collectPayment, setCollectPayment] = useState(false);
  const [issueInvoice, setIssueInvoice] = useState(false);

  // Rich (WordPress-style) rules/conditions editor shown atop the family booking page
  // (teacher-only). The HTML is the source of truth; the legacy font/size/bold values
  // ride along unchanged so nothing is wiped for teachers still on the plain template.
  const { isAssistant } = useActiveAbilities();
  const qc = useQueryClient();
  const { data: pm } = useQuery({ queryKey: ['payment-methods'], queryFn: getPaymentMethods, enabled: !isAssistant });
  const [tpl, setTpl] = useState<BookingTemplate | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  // Initial editor content: the stored rich HTML, else the legacy plain text as paragraphs.
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const htmlRef = useRef<string>('');
  const editorRef = useRef<RichTextEditorRef>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (pm && !tpl) {
      setTpl({
        booking_link_html: pm.booking_link_html,
        booking_link_rules: pm.booking_link_rules,
        booking_link_font: pm.booking_link_font,
        booking_link_font_size: pm.booking_link_font_size,
        booking_link_bold: pm.booking_link_bold,
        booking_logo_url: pm.booking_logo_url,
        booking_title: pm.booking_title,
        booking_intro: pm.booking_intro,
        booking_brand_color: pm.booking_brand_color,
        booking_bg_color: pm.booking_bg_color,
        booking_bg_image_url: pm.booking_bg_image_url,
        booking_font: pm.booking_font,
      });
      const legacy = (pm.booking_link_rules ?? '').trim();
      const seed = (pm.booking_link_html ?? '').trim() || (legacy ? `<p>${legacy.replace(/\n/g, '<br>')}</p>` : '');
      htmlRef.current = seed;
      setInitialHtml(seed);
    }
  }, [pm, tpl]);
  const saveTpl = useMutation({
    mutationFn: (t: BookingTemplate) => saveBookingTemplate(t),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); Alert.alert(t('invite_link.template_saved')); },
    onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('invite_link.failed')),
  });

  const pickTemplateImage = async () => {
    if (uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('invite_link.image_permission')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadBookingLinkImage(res.assets[0].uri);
      editorRef.current?.insertImage(url);
    } catch {
      Alert.alert(t('common.error'), t('invite_link.image_failed'));
    } finally {
      setUploading(false);
    }
  };

  const setTplField = (patch: Partial<BookingTemplate>) => setTpl((s) => (s ? { ...s, ...patch } : s));

  // Upload a header logo (separate from inline rules images) and store its URL.
  const pickLogo = async () => {
    if (uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('invite_link.image_permission')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadBookingLinkImage(res.assets[0].uri);
      setTplField({ booking_logo_url: url });
    } catch {
      Alert.alert(t('common.error'), t('invite_link.image_failed'));
    } finally {
      setUploading(false);
    }
  };

  // Upload a modern background image (blurred on the real page).
  const pickBg = async () => {
    if (uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('invite_link.image_permission')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadBookingLinkImage(res.assets[0].uri);
      setTplField({ booking_bg_image_url: url });
    } catch {
      Alert.alert(t('common.error'), t('invite_link.image_failed'));
    } finally {
      setUploading(false);
    }
  };

  const saveTemplate = () => {
    if (!tpl) return;
    saveTpl.mutate({ ...tpl, booking_link_html: htmlRef.current.trim() || null });
  };

  const FONTS: { key: 'default' | 'cairo' | 'tajawal' | 'amiri'; label: string }[] = [
    { key: 'default', label: t('billing_settings.font_default') }, { key: 'cairo', label: 'Cairo' }, { key: 'tajawal', label: 'Tajawal' }, { key: 'amiri', label: 'Amiri' },
  ];
  const BRAND_SWATCHES = ['#4C1D95', '#2563eb', '#059669', '#dc2626', '#d97706', '#0891b2', '#be185d', '#334155'];
  const BG_SWATCHES = ['#F3F1FA', '#ffffff', '#f0f9ff', '#f0fdf4', '#fff7ed', '#fef2f2', '#f8fafc'];
  const brand = tpl?.booking_brand_color || '#4C1D95';
  const bg = tpl?.booking_bg_color || '#F3F1FA';

  // A course can only be invited into once it has a weekly schedule.
  const eligible = useMemo(() => (courses ?? []).filter((c) => c.slot_count > 0), [courses]);
  const groups = useGroupFilter(eligible, (c) => `${c.name} ${c.grade_name ?? ''}`, (c) => c.grade_name);
  // The student name is OPTIONAL now — the family fills it on the booking form. If the
  // teacher does pre-fill it, it must be Arabic (same rule as the server).
  const nameError = name.trim() !== '' && !isArabicName(name);
  const canSubmit = courseId != null && !nameError && !busy;

  const submit = async () => {
    if (!canSubmit || courseId == null) return;
    setBusy(true);
    try {
      const res = await mintInviteLink(courseId, name.trim() || undefined, { collectPayment, issueInvoice });
      setMinted(res);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? (isNetworkFailure(e) ? t('offline.need_connection_link') : t('invite_link.failed')));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!minted) return;
    try { await Share.share({ message: `${t('invite_link.share_prefix', { name: minted.student_name || minted.course_name })}\n${minted.url}` }); } catch { /* dismissed */ }
  };

  const input = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
  const card = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm } as const;

  return (
    <Surface id="screen.teacher.invite-link" screen>
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}>
        <Surface id="teacher.invite_link.header">
        <PageHero title={t('invite_link.title')} subtitle={t('invite_link.hero_sub')} onBack />
        </Surface>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
        {minted ? (
          <Surface id="teacher.invite_link.minted_card">
          <View style={[card, { padding: 0, overflow: 'hidden' }]}>
            {/* Ready: who it is for, the link, and the one thing to do with it — send it. */}
            <View style={{ backgroundColor: colors.successLight, alignItems: 'center', paddingVertical: spacing.lg }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}>
                <Icon name="success" size={34} color={colors.success} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.successText, marginTop: spacing.sm }}>{t('invite_link.ready')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: spacing.sm, paddingHorizontal: spacing.lg }}>
                <Chip icon="child" text={minted.student_name || t('invite_link.the_family')} />
                <Chip icon="book" text={minted.course_name} />
              </View>
            </View>
            <View style={{ padding: spacing.lg }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' }}>
                {t('invite_link.ready_hint', { student: minted.student_name || t('invite_link.the_family'), course: minted.course_name })}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md }}>
                <Icon name="send" size={16} color={colors.textTertiary} />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textPrimary }} selectable numberOfLines={2}>{minted.url}</Text>
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>{t('invite_link.long_press_copy')}</Text>
              <Surface id="teacher.invite_link.minted_card.share">
              <TouchableOpacity onPress={share} activeOpacity={0.85} accessibilityRole="button"
                style={{ marginTop: spacing.md, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.lg, ...shadows.sm }}>
                <Icon name="send" size={18} color={colors.onPrimary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('invite_link.share')}</Text>
              </TouchableOpacity>
              </Surface>
              <Surface id="teacher.invite_link.minted_card.another">
              <TouchableOpacity onPress={() => { setMinted(null); setName(''); }} activeOpacity={0.85} accessibilityRole="button" style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('invite_link.another')}</Text>
              </TouchableOpacity>
              </Surface>
            </View>
          </View>
          </Surface>
        ) : isLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl4 }} />
        ) : eligible.length === 0 ? (
          <View style={card}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>{t('invite_link.no_courses')}</Text>
          </View>
        ) : (
          <>
            {/* How it goes, in three steps — the family does the typing, not the teacher. */}
            <Surface id="teacher.invite_link.intro">
            <View style={[card, { flexDirection: 'row', gap: spacing.sm }]}>
              {(['step_1', 'step_2', 'step_3'] as const).map((k, i) => (
                <View key={k} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={(['book', 'send', 'success'] as const)[i]} size={19} color={colors.brand} />
                  </View>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 17, color: colors.textPrimary, textAlign: 'center', marginTop: 6 }}>{t(`invite_link.${k}`)}</Text>
                </View>
              ))}
            </View>
            </Surface>

            <Surface id="teacher.invite_link.course_picker">
            <View style={card}>
              <StepHead n={1} title={t('invite_link.course')} />
              <GroupFilter grades={groups.grades} grade={groups.grade} onGrade={groups.setGrade} query={groups.query} onQuery={groups.setQuery} searchable={groups.searchable} />
              {groups.filtered.length === 0 ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary }}>{t('group_filter.none')}</Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {groups.filtered.map((c) => {
                    const on = courseId === Number(c.id);
                    return (
                      <TouchableOpacity key={c.id} onPress={() => setCourseId(Number(c.id))} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5, borderColor: on ? colors.brand : 'transparent', backgroundColor: on ? colors.brandTint : colors.surfaceSunken }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{c.name}{c.grade_name ? ` · ${c.grade_name}` : ''}</Text>
                          {c.schedule_label ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{c.schedule_label}</Text> : null}
                        </View>
                        {on ? <Icon name="success" size={20} color={colors.brand} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
            </Surface>

            <Surface id="teacher.invite_link.student_name">
            <View style={card}>
              <StepHead n={2} title={t('invite_link.student_name_optional')} />
              <TextInput value={name} onChangeText={setName} placeholder={t('invite_link.name_ph_optional')} placeholderTextColor={colors.textTertiary} maxLength={120} style={{ ...input, borderColor: nameError ? colors.danger : colors.border }} />
              {nameError ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 6 }}>{t('invite_phone.name_arabic_error')}</Text> : <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>{t('invite_link.name_hint')}</Text>}
            </View>
            </Surface>

            {/* Per-link booking options. */}
            <Surface id="teacher.invite_link.options">
            <View style={card}>
              <StepHead n={3} title={t('invite_link.options_title')} />
              <Surface id="teacher.invite_link.options.collect_payment">
              <OptionRow icon="money" title={t('invite_link.collect_payment')} hint={t('invite_link.collect_payment_hint')} value={collectPayment} onChange={setCollectPayment} />
              </Surface>
              <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.sm }} />
              <Surface id="teacher.invite_link.options.issue_invoice">
              <OptionRow icon="invoices" title={t('invite_link.issue_invoice')} hint={t('invite_link.issue_invoice_hint')} value={issueInvoice} onChange={setIssueInvoice} />
              </Surface>
            </View>
            </Surface>

            <Surface id="teacher.invite_link.mint_button">
            <TouchableOpacity onPress={submit} disabled={!canSubmit} activeOpacity={0.85} accessibilityRole="button"
              style={{ opacity: canSubmit ? 1 : 0.5, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.lg, ...shadows.sm }}>
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="send" size={19} color={colors.onPrimary} />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('invite_link.mint')}</Text>
            </TouchableOpacity>
            </Surface>

            {/* Editable rules/conditions template shown atop the family booking page. */}
            {tpl ? (
              <Surface id="teacher.invite_link.template" assistantNeeds="teacher">
              <View style={[card, { marginTop: spacing.lg }]}>
                <TouchableOpacity onPress={() => setTplOpen((o) => !o)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="note" size={18} color={colors.brand} outline />
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('invite_link.template_title')}</Text>
                  <Icon name={tplOpen ? 'down' : 'back'} size={16} color={colors.textTertiary} />
                </TouchableOpacity>

                {tplOpen ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('invite_link.template_hint')}</Text>

                    {/* Live preview of the family page. */}
                    <Surface id="teacher.invite_link.template.preview">
                    {(() => {
                      const innerCard = (
                        <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md }}>
                          {tpl.booking_logo_url ? (
                            <Image source={{ uri: tpl.booking_logo_url }} style={{ width: 120, height: 54, alignSelf: 'center', marginBottom: spacing.sm }} contentFit="contain" />
                          ) : null}
                          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: brand, textAlign: 'center' }}>{(tpl.booking_title || '').trim() || t('enroll_ui.preview_booking_title')}</Text>
                          {(tpl.booking_intro || '').trim() ? (
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: onWhite.muted, textAlign: 'center', marginTop: 4 }}>{tpl.booking_intro}</Text>
                          ) : null}
                          <View style={{ backgroundColor: '#f3ecfd', borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: brand, textAlign: 'center' }}>{t('enroll_ui.preview_enroll_in_course')}</Text>
                          </View>
                          <View style={{ backgroundColor: brand, borderRadius: radius.md, paddingVertical: spacing.sm, marginTop: spacing.sm }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff', textAlign: 'center' }}>{t('enroll_ui.preview_agree')}</Text>
                          </View>
                        </View>
                      );
                      return tpl.booking_bg_image_url ? (
                        <ImageBackground source={{ uri: tpl.booking_bg_image_url }} blurRadius={5} imageStyle={{ borderRadius: radius.lg }}
                          style={{ borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md }}>
                          <View style={{ backgroundColor: 'rgba(18,10,38,0.18)', padding: spacing.md }}>{innerCard}</View>
                        </ImageBackground>
                      ) : (
                        <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}>{innerCard}</View>
                      );
                    })()}
                    </Surface>

                    {/* Logo */}
                    <Surface id="teacher.invite_link.template.logo">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                      {tpl.booking_logo_url ? <Image source={{ uri: tpl.booking_logo_url }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="contain" /> : null}
                      <TouchableOpacity onPress={pickLogo} disabled={uploading} activeOpacity={0.85} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{t('invite_link.upload_logo')}</Text>
                      </TouchableOpacity>
                      {tpl.booking_logo_url ? (
                        <TouchableOpacity onPress={() => setTplField({ booking_logo_url: null })} activeOpacity={0.85}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger }}>{t('invite_link.remove')}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    </Surface>

                    {/* Title + intro */}
                    <Surface id="teacher.invite_link.template.title_intro">
                    <TextInput value={tpl.booking_title ?? ''} onChangeText={(v) => setTplField({ booking_title: v })} placeholder={t('invite_link.page_title_ph')} placeholderTextColor={colors.textTertiary} maxLength={120} style={{ ...input, marginBottom: spacing.sm }} />
                    <TextInput value={tpl.booking_intro ?? ''} onChangeText={(v) => setTplField({ booking_intro: v })} placeholder={t('invite_link.page_intro_ph')} placeholderTextColor={colors.textTertiary} multiline maxLength={500} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, minHeight: 64, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top', marginBottom: spacing.md }} />
                    </Surface>

                    {/* Brand + background colours */}
                    <Surface id="teacher.invite_link.template.colors">
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('invite_link.brand_color')}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                      {BRAND_SWATCHES.map((c) => (
                        <TouchableOpacity key={c} onPress={() => setTplField({ booking_brand_color: c })} activeOpacity={0.8}
                          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: brand.toLowerCase() === c.toLowerCase() ? 3 : 1, borderColor: brand.toLowerCase() === c.toLowerCase() ? colors.textPrimary : colors.border }} />
                      ))}
                    </View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('invite_link.bg_color')}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                      {BG_SWATCHES.map((c) => (
                        <TouchableOpacity key={c} onPress={() => setTplField({ booking_bg_color: c })} activeOpacity={0.8}
                          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: bg.toLowerCase() === c.toLowerCase() ? 3 : 1, borderColor: bg.toLowerCase() === c.toLowerCase() ? colors.textPrimary : colors.border }} />
                      ))}
                    </View>
                    </Surface>

                    {/* Background image (modern blurred) */}
                    <Surface id="teacher.invite_link.template.bg_image">
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('invite_link.bg_image')}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                      {tpl.booking_bg_image_url ? <Image source={{ uri: tpl.booking_bg_image_url }} style={{ width: 44, height: 44, borderRadius: 8 }} contentFit="cover" /> : null}
                      <TouchableOpacity onPress={pickBg} disabled={uploading} activeOpacity={0.85} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{t('invite_link.upload_bg')}</Text>
                      </TouchableOpacity>
                      {tpl.booking_bg_image_url ? (
                        <TouchableOpacity onPress={() => setTplField({ booking_bg_image_url: null })} activeOpacity={0.85}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger }}>{t('invite_link.remove')}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    </Surface>

                    {/* Page font */}
                    <Surface id="teacher.invite_link.template.font">
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('billing_settings.font')}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                      {FONTS.map((f) => {
                        const on = (tpl.booking_font ?? 'default') === f.key;
                        return (
                          <TouchableOpacity key={f.key} onPress={() => setTplField({ booking_font: f.key })} activeOpacity={0.85}
                            style={{ paddingHorizontal: spacing.md, height: 34, justifyContent: 'center', borderRadius: radius.full, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surfaceSunken }}>
                            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: on ? colors.brand : colors.textSecondary }}>{f.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    </Surface>

                    <Surface id="teacher.invite_link.template.rules_editor">
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginBottom: spacing.xs }}>{t('invite_link.rules_label')}</Text>
                    {initialHtml !== null ? (
                      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' }}>
                        <RichTextEditor
                          ref={editorRef}
                          initialHtml={initialHtml}
                          placeholder={t('invite_link.template_ph')}
                          height={300}
                          onChangeHtml={(h) => { htmlRef.current = h; }}
                          onPickImage={pickTemplateImage}
                        />
                      </View>
                    ) : (
                      <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.lg }} />
                    )}
                    {uploading ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>{t('invite_link.image_uploading')}</Text>
                    ) : null}
                    </Surface>
                    <Surface id="teacher.invite_link.template.save">
                    <TouchableOpacity onPress={saveTemplate} disabled={saveTpl.isPending} activeOpacity={0.85}
                      style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', opacity: saveTpl.isPending ? 0.6 : 1 }}>
                      {saveTpl.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('invite_link.save_template')}</Text>}
                    </TouchableOpacity>
                    </Surface>
                  </View>
                ) : null}
              </View>
              </Surface>
            ) : null}
          </>
        )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </Surface>
  );
}

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.onPrimary }}>{formatNumber(n)}</Text>
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
    </View>
  );
}

function OptionRow({ icon, title, hint, value, onChange }: { icon: IconName; title: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: value ? colors.brandTint : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={value ? colors.brand : colors.textTertiary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 2 }}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brand }} />
    </View>
  );
}

function Chip({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Icon name={icon} size={13} color={colors.textSecondary} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }} numberOfLines={1}>{text}</Text>
    </View>
  );
}
