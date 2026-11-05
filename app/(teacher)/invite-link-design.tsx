import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, ImageBackground } from 'react-native';
import { Alert } from '@/ui/dialog';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { PageHero } from '@/components/ui/PageHero';
import { onWhite } from '@/theme/onWhite';
import { RichTextEditor, type RichTextEditorRef } from '@/components/RichTextEditor';
import { getPaymentMethods, saveBookingTemplate, uploadBookingLinkImage, type BookingTemplate } from '@/api/paymentMethods';
import { Surface } from '@/ui/surfaces';
import { Chips, SwatchRow } from '@/components/ui/Form';

/**
 * The family's booking page — what a parent sees on opening an invite link: logo, title,
 * intro, colours, background, font and the rich rules/conditions block. Its own page
 * (founder 2026-11-05: it sat folded at the very bottom of «دعوة برابط»), opened from the
 * small «تصميم الصفحة» button at the top of that screen. Teacher only.
 */
export default function InviteLinkDesign() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: pm } = useQuery({ queryKey: ['payment-methods'], queryFn: getPaymentMethods });
  const [tpl, setTpl] = useState<BookingTemplate | null>(null);
  // Initial editor content: the stored rich HTML, else the legacy plain text as paragraphs.
  // The HTML is the source of truth; the legacy font/size/bold values ride along unchanged
  // so nothing is wiped for teachers still on the plain template.
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
    mutationFn: (v: BookingTemplate) => saveBookingTemplate(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); Alert.alert(t('invite_link.template_saved')); },
    onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('invite_link.failed')),
  });

  const setTplField = (patch: Partial<BookingTemplate>) => setTpl((s) => (s ? { ...s, ...patch } : s));

  // One picker for the three images: inline in the rules, the header logo, the blurred background.
  const pickImage = async (use: (url: string) => void, quality: number) => {
    if (uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('invite_link.image_permission')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(true);
    try {
      use(await uploadBookingLinkImage(res.assets[0].uri));
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

  const input = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
  const card = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm } as const;
  const label = { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs };

  return (
    <Surface id="screen.teacher.invite-link-design" screen>
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}>
        <PageHero title={t('invite_link.design_title')} subtitle={t('invite_link.template_hint')} onBack />

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
        {!tpl ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl4 }} />
        ) : (
          <Surface id="teacher.invite_link.template" assistantNeeds="teacher">
            {/* Live preview of the family page. */}
            <Surface id="teacher.invite_link.template.preview">
            <View style={card}>
              <Text style={[label, { marginBottom: spacing.sm }]}>{t('invite_link.preview_label')}</Text>
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
                    style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
                    <View style={{ backgroundColor: 'rgba(18,10,38,0.18)', padding: spacing.md }}>{innerCard}</View>
                  </ImageBackground>
                ) : (
                  <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>{innerCard}</View>
                );
              })()}
            </View>
            </Surface>

            <View style={card}>
              {/* Logo */}
              <Surface id="teacher.invite_link.template.logo">
              <Text style={label}>{t('invite_link.upload_logo')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                {tpl.booking_logo_url ? <Image source={{ uri: tpl.booking_logo_url }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="contain" /> : null}
                <TouchableOpacity onPress={() => pickImage((url) => setTplField({ booking_logo_url: url }), 0.8)} disabled={uploading} activeOpacity={0.85} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
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
              <TextInput value={tpl.booking_intro ?? ''} onChangeText={(v) => setTplField({ booking_intro: v })} placeholder={t('invite_link.page_intro_ph')} placeholderTextColor={colors.textTertiary} multiline maxLength={500} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, minHeight: 64, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top' }} />
              </Surface>
            </View>

            <View style={card}>
              {/* Brand + background colours */}
              <Surface id="teacher.invite_link.template.colors">
              <Text style={label}>{t('invite_link.brand_color')}</Text>
              <View style={{ marginBottom: spacing.md }}>
                <SwatchRow swatches={BRAND_SWATCHES} value={brand} onChange={(c) => setTplField({ booking_brand_color: c })} />
              </View>
              <Text style={label}>{t('invite_link.bg_color')}</Text>
              <View style={{ marginBottom: spacing.md }}>
                <SwatchRow swatches={BG_SWATCHES} value={bg} onChange={(c) => setTplField({ booking_bg_color: c })} />
              </View>
              </Surface>

              {/* Background image (modern blurred) */}
              <Surface id="teacher.invite_link.template.bg_image">
              <Text style={label}>{t('invite_link.bg_image')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                {tpl.booking_bg_image_url ? <Image source={{ uri: tpl.booking_bg_image_url }} style={{ width: 44, height: 44, borderRadius: 8 }} contentFit="cover" /> : null}
                <TouchableOpacity onPress={() => pickImage((url) => setTplField({ booking_bg_image_url: url }), 0.8)} disabled={uploading} activeOpacity={0.85} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
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
              <Text style={label}>{t('billing_settings.font')}</Text>
              <Chips options={FONTS} value={tpl.booking_font ?? 'default'} onChange={(k) => setTplField({ booking_font: k })} />
              </Surface>
            </View>

            <View style={card}>
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
                    onPickImage={() => pickImage((url) => editorRef.current?.insertImage(url), 0.7)}
                  />
                </View>
              ) : (
                <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.lg }} />
              )}
              {uploading ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>{t('invite_link.image_uploading')}</Text>
              ) : null}
              </Surface>
            </View>

            <Surface id="teacher.invite_link.template.save">
            <TouchableOpacity onPress={saveTemplate} disabled={saveTpl.isPending} activeOpacity={0.85} accessibilityRole="button"
              style={{ minHeight: 54, backgroundColor: colors.brand, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', opacity: saveTpl.isPending ? 0.6 : 1, ...shadows.sm }}>
              {saveTpl.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('invite_link.save_template')}</Text>}
            </TouchableOpacity>
            </Surface>
          </Surface>
        )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </Surface>
  );
}
