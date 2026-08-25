import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Share, Alert, KeyboardAvoidingView, Switch, Image, ImageBackground } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { RichTextEditor, type RichTextEditorRef } from '@/components/RichTextEditor';
import { useCourses } from '@/hooks/useCourses';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { mintInviteLink, type MintedInviteLink } from '@/api/invitation';
import { getPaymentMethods, saveBookingTemplate, uploadBookingLinkImage, type BookingTemplate } from '@/api/paymentMethods';
import { isArabicName } from '@/utils/validators';

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
    { key: 'default', label: 'افتراضي' }, { key: 'cairo', label: 'Cairo' }, { key: 'tajawal', label: 'Tajawal' }, { key: 'amiri', label: 'Amiri' },
  ];
  const BRAND_SWATCHES = ['#4C1D95', '#2563eb', '#059669', '#dc2626', '#d97706', '#0891b2', '#be185d', '#334155'];
  const BG_SWATCHES = ['#F3F1FA', '#ffffff', '#f0f9ff', '#f0fdf4', '#fff7ed', '#fef2f2', '#f8fafc'];
  const brand = tpl?.booking_brand_color || '#4C1D95';
  const bg = tpl?.booking_bg_color || '#F3F1FA';

  // A course can only be invited into once it has a weekly schedule.
  const eligible = useMemo(() => (courses ?? []).filter((c) => c.slot_count > 0), [courses]);
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
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('invite_link.failed'));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!minted) return;
    try { await Share.share({ message: `${t('invite_link.share_prefix', { name: minted.student_name || minted.course_name })}\n${minted.url}` }); } catch { /* dismissed */ }
  };

  const input = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
  const card = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg } as const;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Icon name="forward" size={22} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('invite_link.title')}</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.lg }}>
          {t('invite_link.intro')}
        </Text>

        {minted ? (
          <View style={card}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.success, marginBottom: spacing.xs }}>{t('invite_link.ready')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              {t('invite_link.ready_hint', { student: minted.student_name || t('invite_link.the_family'), course: minted.course_name })}
            </Text>
            <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }} selectable>{minted.url}</Text>
            </View>
            <TouchableOpacity onPress={share} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.md }}>
              <Icon name="forward" size={18} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('invite_link.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMinted(null); setName(''); }} activeOpacity={0.85} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('invite_link.another')}</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : eligible.length === 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>{t('invite_link.no_courses')}</Text>
        ) : (
          <>
            <View style={card}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('invite_link.course')}</Text>
              {eligible.map((c) => (
                <TouchableOpacity key={c.id} onPress={() => setCourseId(Number(c.id))} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: courseId === Number(c.id) ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {courseId === Number(c.id) ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} /> : null}
                  </View>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }}>{c.name}{c.grade_name ? ` — ${c.grade_name}` : ''}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={card}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('invite_link.student_name_optional')}</Text>
              <TextInput value={name} onChangeText={setName} placeholder={t('invite_link.name_ph_optional')} placeholderTextColor={colors.textTertiary} maxLength={120} style={{ ...input, borderColor: nameError ? colors.danger : colors.border }} />
              {nameError ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 6 }}>{t('invite_phone.name_arabic_error')}</Text> : null}
            </View>

            {/* Per-link booking options. */}
            <View style={card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('invite_link.collect_payment')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('invite_link.collect_payment_hint')}</Text>
                </View>
                <Switch value={collectPayment} onValueChange={setCollectPayment} trackColor={{ true: colors.brand }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs, marginTop: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('invite_link.issue_invoice')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('invite_link.issue_invoice_hint')}</Text>
                </View>
                <Switch value={issueInvoice} onValueChange={setIssueInvoice} trackColor={{ true: colors.brand }} />
              </View>
            </View>

            <TouchableOpacity onPress={submit} disabled={!canSubmit} activeOpacity={0.85} style={{ opacity: canSubmit ? 1 : 0.5, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center' }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('invite_link.mint')}</Text>}
            </TouchableOpacity>

            {/* Editable rules/conditions template shown atop the family booking page. */}
            {!isAssistant && tpl ? (
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
                    {(() => {
                      const innerCard = (
                        <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md }}>
                          {tpl.booking_logo_url ? (
                            <Image source={{ uri: tpl.booking_logo_url }} style={{ width: 120, height: 54, resizeMode: 'contain', alignSelf: 'center', marginBottom: spacing.sm }} />
                          ) : null}
                          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: brand, textAlign: 'center' }}>{(tpl.booking_title || '').trim() || 'حجز مكان'}</Text>
                          {(tpl.booking_intro || '').trim() ? (
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>{tpl.booking_intro}</Text>
                          ) : null}
                          <View style={{ backgroundColor: '#f3ecfd', borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: brand, textAlign: 'center' }}>تسجيل الطالب في «المقرر»</Text>
                          </View>
                          <View style={{ backgroundColor: brand, borderRadius: radius.md, paddingVertical: spacing.sm, marginTop: spacing.sm }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff', textAlign: 'center' }}>أوافق على التسجيل</Text>
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

                    {/* Logo */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                      {tpl.booking_logo_url ? <Image source={{ uri: tpl.booking_logo_url }} style={{ width: 40, height: 40, borderRadius: 8, resizeMode: 'contain' }} /> : null}
                      <TouchableOpacity onPress={pickLogo} disabled={uploading} activeOpacity={0.85} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{t('invite_link.upload_logo')}</Text>
                      </TouchableOpacity>
                      {tpl.booking_logo_url ? (
                        <TouchableOpacity onPress={() => setTplField({ booking_logo_url: null })} activeOpacity={0.85}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger }}>{t('invite_link.remove')}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Title + intro */}
                    <TextInput value={tpl.booking_title ?? ''} onChangeText={(v) => setTplField({ booking_title: v })} placeholder={t('invite_link.page_title_ph')} placeholderTextColor={colors.textTertiary} maxLength={120} style={{ ...input, marginBottom: spacing.sm }} />
                    <TextInput value={tpl.booking_intro ?? ''} onChangeText={(v) => setTplField({ booking_intro: v })} placeholder={t('invite_link.page_intro_ph')} placeholderTextColor={colors.textTertiary} multiline maxLength={500} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, minHeight: 64, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top', marginBottom: spacing.md }} />

                    {/* Brand + background colours */}
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

                    {/* Background image (modern blurred) */}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('invite_link.bg_image')}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                      {tpl.booking_bg_image_url ? <Image source={{ uri: tpl.booking_bg_image_url }} style={{ width: 44, height: 44, borderRadius: 8, resizeMode: 'cover' }} /> : null}
                      <TouchableOpacity onPress={pickBg} disabled={uploading} activeOpacity={0.85} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{t('invite_link.upload_bg')}</Text>
                      </TouchableOpacity>
                      {tpl.booking_bg_image_url ? (
                        <TouchableOpacity onPress={() => setTplField({ booking_bg_image_url: null })} activeOpacity={0.85}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger }}>{t('invite_link.remove')}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Page font */}
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
                    <TouchableOpacity onPress={saveTemplate} disabled={saveTpl.isPending} activeOpacity={0.85}
                      style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', opacity: saveTpl.isPending ? 0.6 : 1 }}>
                      {saveTpl.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('invite_link.save_template')}</Text>}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
