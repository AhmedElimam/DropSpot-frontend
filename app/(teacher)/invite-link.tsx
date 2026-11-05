import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Share, KeyboardAvoidingView, Switch } from 'react-native';
import { Alert } from '@/ui/dialog';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { PageHero } from '@/components/ui/PageHero';
import { SheetModal } from '@/components/ui/SheetModal';
import { GroupFilter, useGroupFilter } from '@/components/teacher/GroupFilter';
import { formatNumber } from '@/utils/format';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useCourses } from '@/hooks/useCourses';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { mintInviteLink, type MintedInviteLink } from '@/api/invitation';
import { isNetworkFailure } from '@/db/marksSync';
import { isArabicName } from '@/utils/validators';
import { Surface } from '@/ui/surfaces';

/**
 * Invite-by-link (mobile parity for the web "رابط مُعبّأ" channel): the teacher picks
 * a course + student name, mints a single-use link, and shares it with the family —
 * who open it, confirm, and self-register into that course. No phone number needed.
 *
 * Founder 2026-11-05: the ready link opens in a sheet over the form (it used to replace the
 * form at the top of the page while the teacher was scrolled down at the button), and the
 * family page's design has its own screen behind the small «تصميم الصفحة» button up top.
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

  const { isAssistant } = useActiveAbilities();

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
        <PageHero title={t('invite_link.title')} subtitle={t('invite_link.hero_sub')} onBack
          action={isAssistant ? undefined : { icon: 'note', label: t('invite_link.design_button'), onPress: () => router.push('/(teacher)/invite-link-design' as Href) }} />
        </Surface>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
        {isLoading ? (
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
          </>
        )}
        </View>
      </ScrollView>

      {/* The link, ready: in a sheet over the form, wherever the teacher had scrolled to. */}
      <SheetModal visible={!!minted} onClose={() => setMinted(null)} style={{ backgroundColor: colors.surface, padding: 0, overflow: 'hidden' }}>
        {minted ? (
          <Surface id="teacher.invite_link.minted_card">
          <View>
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
            <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
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
        ) : null}
      </SheetModal>
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
