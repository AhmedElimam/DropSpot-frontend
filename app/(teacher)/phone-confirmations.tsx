import { SheetModal } from '@/components/ui/SheetModal';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { Alert } from '@/ui/dialog';
import { FlatList } from '@/components/ui/Refreshable';
import { SelectField } from '@/components/ui/SelectField';
import { foldForSearch, relationshipLabel, formatNumber } from '@/utils/format';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { usePhoneConfirmations, PHONE_CONFIRMATIONS_KEY } from '@/hooks/usePhoneConfirmations';
import { acknowledgePhone, sendPhoneConfirmationCode, confirmPhoneCode, type PhoneConfirmation } from '@/api/phoneConfirmations';
import { requestStudentEdit, flagParentNumber } from '@/api/students';
import { Surface } from '@/ui/surfaces';

/**
 * «أرقام تحتاج تأكيد» — spec §5.
 *
 * The three resolutions, in the order a teacher actually reaches for them:
 *   1. الرقم صحيح   — a human who knows the family vouches. Ends the nagging for THIS
 *                     number; correcting it later brings the row back on its own.
 *   2. تعديل الرقم  — a correction. The student's own number goes through the existing
 *                     edit-request (auto-applies inside the typo window); a parent's
 *                     number is attached to an escalation as a PROPOSAL, because it is
 *                     a login credential no teacher may rewrite directly.
 *   3. إبلاغ الإدارة — the number is not genuine. Hands it to the admins and the row
 *                     leaves this list: it is no longer the teacher's to solve.
 *
 * Open to the teacher AND every assistant by default. Actions that carry a heavier
 * review policy keep their own ability (manage_students / report_incidents) and are
 * hidden rather than offered-then-refused.
 */

type Sheet =
  | { kind: 'ack'; item: PhoneConfirmation }
  | { kind: 'otp'; item: PhoneConfirmation }
  | { kind: 'edit'; item: PhoneConfirmation }
  | { kind: 'escalate'; item: PhoneConfirmation }
  | null;

export default function PhoneConfirmationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = usePhoneConfirmations();
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [note, setNote] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [busy, setBusy] = useState(false);
  // Door-side confirmation: the code is sent, then read back off the family's handset.
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const items = data?.items ?? [];

  // Filters (founder 2026-10-30: teachers got lost in one long list) — which number needs
  // confirming, which group, and a search over name / code / either number.
  const [kind, setKind] = useState<'all' | 'parent' | 'student'>('all');
  const [groupId, setGroupId] = useState('');
  const [query, setQuery] = useState('');

  // One card per student: a family with two unverified numbers reads as one problem, and the
  // card carries BOTH numbers (founder: «one column should carry both student and his parent
  // phone number») with the student's group(s).
  const families = useMemo(() => {
    const by = new Map<number, Family>();
    for (const it of items) {
      const f = by.get(it.student_id) ?? { id: it.student_id, first: it, rows: [] };
      f.rows.push(it);
      by.set(it.student_id, f);
    }
    return Array.from(by.values());
  }, [items]);

  const groupOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const f of families) for (const g of f.first.groups ?? []) if (g.schedule_id != null) seen.set(String(g.schedule_id), g.label);
    return [{ key: '', label: t('staff_ui.phone_filter_all_groups') }, ...Array.from(seen, ([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'ar'))];
  }, [families, t]);

  const shown = useMemo(() => {
    const q = foldForSearch(query);
    return families.filter((f) => {
      if (kind !== 'all' && !f.rows.some((r) => r.scope === kind)) return false;
      if (groupId && !(f.first.groups ?? []).some((g) => String(g.schedule_id) === groupId)) return false;
      if (!q) return true;
      return [f.first.student_name, f.first.student_code, f.first.student_phone, f.first.parent_phone, f.first.parent_name]
        .some((v) => foldForSearch(v).includes(q));
    });
  }, [families, kind, groupId, query]);

  const closeSheet = () => { setSheet(null); setNote(''); setNewNumber(''); setOtpCode(''); setOtpSent(false); };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: PHONE_CONFIRMATIONS_KEY });
    qc.invalidateQueries({ queryKey: ['resolution-summary'] });
  };

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      invalidate();
      closeSheet();
      Alert.alert('', done);
    } catch (e) {
      Alert.alert(t('staff_ui.error'), getFriendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Sending keeps the sheet OPEN — the next thing the teacher does is type the digits, and
  // closing here would make them find the row again with the code already spent.
  const sendCode = async (it: PhoneConfirmation) => {
    setBusy(true);
    try {
      await sendPhoneConfirmationCode(it.student_id, it.scope, it.subject_id);
      setOtpSent(true);
      Alert.alert('', t('staff_ui.phone_code_sent'));
    } catch (e) {
      Alert.alert(t('staff_ui.error'), getFriendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = (it: PhoneConfirmation) => {
    const code = otpCode.trim();
    if (code.length < 4) {
      Alert.alert('', t('staff_ui.phone_code_too_short'));
      return;
    }
    return run(
      () => confirmPhoneCode(it.student_id, it.scope, it.subject_id, code),
      t('staff_ui.phone_code_confirmed'),
    );
  };

  const submitAck = (it: PhoneConfirmation) =>
    run(
      () => acknowledgePhone(it.student_id, it.scope, it.subject_id, note.trim() || undefined),
      t('staff_ui.phone_ack_done'),
    );

  const submitEdit = (it: PhoneConfirmation) => {
    const phone = newNumber.trim();
    if (phone.length < 8) {
      Alert.alert('', t('staff_ui.phone_enter_correct_first'));
      return;
    }
    if (it.scope === 'student') {
      return run(
        () => requestStudentEdit(it.student_id, { phone, reason: t('staff_ui.phone_edit_student_reason') }),
        t('staff_ui.phone_edit_sent_student'),
      );
    }
    // A parent's number is a login credential — attached as a proposal on an escalation,
    // which the admins verify before applying (and they re-invite the real parent).
    return run(
      () => flagParentNumber(it.student_id, {
        parent_id: it.subject_id,
        reason: note.trim() || t('staff_ui.phone_parent_wrong_reason'),
        proposed_number: phone,
      }),
      t('staff_ui.phone_edit_sent_parent'),
    );
  };

  const submitEscalate = (it: PhoneConfirmation) => {
    if (note.trim().length < 3) {
      Alert.alert('', t('staff_ui.phone_escalate_reason_required'));
      return;
    }
    return run(
      () => flagParentNumber(it.student_id, { parent_id: it.subject_id, reason: note.trim() }),
      t('staff_ui.phone_escalate_sent'),
    );
  };

  /** What can be done about ONE number that needs confirming. */
  const Actions = ({ it }: { it: PhoneConfirmation }) => {
    return (
      <View>

        {/* Proof first. A code the family reads back is stronger than anyone's word (§7),
            so it leads the row; vouching stays for the families who cannot receive SMS. */}
        <Surface id="teacher.phone_confirmations.confirm_by_code">
        <TouchableOpacity
          onPress={() => { setOtpCode(''); setOtpSent(false); setSheet({ kind: 'otp', item: it }); }}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: 12, marginTop: spacing.md,
          }}
        >
          <Icon name="call" size={16} color={colors.white} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.white }}>{t('staff_ui.phone_confirm_by_code')}</Text>
        </TouchableOpacity>
        </Surface>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <Surface id="teacher.phone_confirmations.number_correct">
          <TouchableOpacity
            onPress={() => { setNote(''); setSheet({ kind: 'ack', item: it }); }}
            activeOpacity={0.85}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success,
              borderRadius: radius.lg, paddingVertical: 10,
            }}
          >
            <Icon name="success" size={15} color={colors.success} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.success }}>{t('staff_ui.phone_number_correct')}</Text>
          </TouchableOpacity>
          </Surface>

          {/* A student's number is a roster edit (manage_students); a parent's is a login
              credential, so correcting it is an escalation (report_incidents). */}
          <Surface id="teacher.phone_confirmations.edit_number" assistantNeeds={it.scope === 'student' ? 'manage_students' : 'report_incidents'}>
          <TouchableOpacity
            onPress={() => { setNote(''); setNewNumber(''); setSheet({ kind: 'edit', item: it }); }}
            activeOpacity={0.85}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border,
              borderRadius: radius.lg, paddingVertical: 10,
            }}
          >
            <Icon name="note" size={15} color={colors.textPrimary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{t('staff_ui.edit_number')}</Text>
          </TouchableOpacity>
          </Surface>

          <Surface id="teacher.phone_confirmations.escalate" assistantNeeds="report_incidents">
          {it.can_escalate ? (
            <TouchableOpacity
              onPress={() => { setNote(''); setSheet({ kind: 'escalate', item: it }); }}
              activeOpacity={0.85}
              style={{
                width: 44, alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border,
                borderRadius: radius.lg, paddingVertical: 10,
              }}
            >
              <Icon name="warning" size={16} color={colors.warningText} />
            </TouchableOpacity>
          ) : null}
          </Surface>
        </View>
      </View>
    );
  };

  const sheetTitle = sheet?.kind === 'ack' ? t('staff_ui.phone_ack_title')
    : sheet?.kind === 'otp' ? t('staff_ui.phone_confirm_by_code')
      : sheet?.kind === 'edit' ? t('staff_ui.edit_number')
        : t('staff_ui.phone_escalate_title');

  return (
    <Surface id="screen.teacher.phone-confirmations" screen>
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <Surface id="teacher.phone_confirmations.header">
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.borderLight,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}
        >
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('home.phones_title')}</Text>
      </View>
      </Surface>

      <Surface id="teacher.phone_confirmations.list">
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(f) => String(f.id)}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={families.length === 0 ? null : (
            <Surface id="teacher.phone_confirmations.filters">
            <View style={{ marginBottom: spacing.md, gap: spacing.sm }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
                {t('staff_ui.phone_intro')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 46 }}>
                <Icon name="search" size={16} color={colors.textTertiary} />
                <TextInput value={query} onChangeText={setQuery} placeholder={t('staff_ui.phone_search_ph')} placeholderTextColor={colors.textTertiary}
                  style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, paddingVertical: 8 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {(['all', 'parent', 'student'] as const).map((k) => (
                  <TouchableOpacity key={k} onPress={() => setKind(k)} accessibilityRole="button" accessibilityState={{ selected: kind === k }} activeOpacity={0.85}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: kind === k ? colors.brand : colors.border, backgroundColor: kind === k ? colors.brand : colors.surface }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: kind === k ? colors.white : colors.textSecondary }}>{t(`staff_ui.phone_filter_${k}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {groupOptions.length > 2 ? (
                <SelectField value={groupId} options={groupOptions} placeholder={t('staff_ui.phone_filter_all_groups')} onChange={setGroupId} />
              ) : null}
              {shown.length !== families.length ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>
                  {t('staff_ui.phone_filter_shown', { n: formatNumber(shown.length), total: formatNumber(families.length) })}
                </Text>
              ) : null}
            </View>
            </Surface>
          )}
          ListEmptyComponent={families.length === 0 ? (
            <EmptyState icon="success" title={t('staff_ui.phone_all_confirmed')} message={t('staff_ui.phone_none_pending')} />
          ) : (
            <EmptyState icon="search" title={t('staff_ui.phone_filter_none')} message={t('staff_ui.phone_filter_none_hint')} />
          )}
          renderItem={({ item: f }) => <FamilyCard f={f} Actions={Actions} />}
        />
      )}
      </Surface>

      <Surface id="teacher.phone_confirmations.sheet">
      <SheetModal visible={sheet !== null} onClose={closeSheet} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.xxl, paddingBottom: spacing.xl5 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{sheetTitle}</Text>

            {sheet?.kind === 'ack' ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }}>
                {t('staff_ui.phone_ack_body')}
              </Text>
            ) : null}
            {sheet?.kind === 'otp' ? (
              <>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }}>
                  {otpSent
                    ? t('staff_ui.phone_otp_sent_hint')
                    : t('staff_ui.phone_otp_send_hint')}
                </Text>
                {otpSent ? (
                  <TextInput
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp"
                    maxLength={8}
                    placeholder={t('staff_ui.phone_code_placeholder')}
                    placeholderTextColor={colors.textTertiary}
                    style={{
                      marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
                      paddingHorizontal: spacing.md, minHeight: 48, fontFamily: fonts.bold, fontSize: 18,
                      color: colors.textPrimary, textAlign: 'center', letterSpacing: 4,
                    }}
                  />
                ) : null}
              </>
            ) : null}
            {sheet?.kind === 'edit' ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }}>
                {sheet.item.scope === 'student'
                  ? t('staff_ui.phone_edit_student_hint')
                  : t('staff_ui.phone_edit_parent_hint')}
              </Text>
            ) : null}
            {sheet?.kind === 'escalate' ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }}>
                {t('staff_ui.phone_escalate_body')}
              </Text>
            ) : null}

            {sheet?.kind === 'edit' ? (
              <TextInput
                value={newNumber}
                onChangeText={setNewNumber}
                keyboardType="phone-pad"
                placeholder={t('staff_ui.phone_correct_number_ph')}
                placeholderTextColor={colors.textTertiary}
                style={{
                  marginTop: spacing.lg, backgroundColor: colors.surfaceSunken,
                  borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
                  paddingHorizontal: spacing.md, paddingVertical: spacing.md,
                  fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary,
                  textAlign: 'left', writingDirection: 'ltr',
                }}
              />
            ) : null}

            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={sheet?.kind === 'escalate' ? t('staff_ui.phone_escalate_reason_ph') : t('staff_ui.note_optional')}
              placeholderTextColor={colors.textTertiary}
              style={{
                marginTop: spacing.md, minHeight: 72, backgroundColor: colors.surfaceSunken,
                borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
                paddingHorizontal: spacing.md, paddingVertical: spacing.md,
                fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary,
                textAlignVertical: 'top',
              }}
            />

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <TouchableOpacity
                onPress={closeSheet}
                disabled={busy}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Surface id="teacher.phone_confirmations.sheet.submit">
              <TouchableOpacity
                onPress={() => {
                  if (!sheet) return;
                  if (sheet.kind === 'ack') submitAck(sheet.item);
                  else if (sheet.kind === 'otp') { if (otpSent) submitCode(sheet.item); else void sendCode(sheet.item); }
                  else if (sheet.kind === 'edit') submitEdit(sheet.item);
                  else submitEscalate(sheet.item);
                }}
                disabled={busy}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.lg,
                  backgroundColor: busy ? colors.border : colors.brand,
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>
                    {sheet?.kind === 'ack' ? t('common.confirm')
                      : sheet?.kind === 'otp' ? (otpSent ? t('staff_ui.phone_confirm_code_btn') : t('staff_ui.send_code'))
                        : sheet?.kind === 'edit' ? t('staff_ui.send') : t('staff_ui.report_btn')}
                  </Text>
                )}
              </TouchableOpacity>
              </Surface>
            </View>
      </SheetModal>
      </Surface>
    </View>
    </Surface>
  );
}

type Family = { id: number; first: PhoneConfirmation; rows: PhoneConfirmation[] };

/**
 * One student: name, code, group(s), and BOTH numbers — each marked confirmed or not, with the
 * actions under the one that needs it. The number in question is never on its own, so a parent
 * number typed into the student's field (or the same number twice) shows at a glance.
 */
function FamilyCard({ f, Actions }: { f: Family; Actions: (p: { it: PhoneConfirmation }) => ReactElement }) {
  const { t } = useTranslation();
  const it = f.first;
  const parentRow = f.rows.find((r) => r.scope === 'parent');
  const studentRow = f.rows.find((r) => r.scope === 'student');
  const sameNumber = !!it.student_phone && it.student_phone === it.parent_phone;
  const rel = relationshipLabel(it.parent_relationship);
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: colors.warning, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brand }}>{(it.student_name ?? '؟').trim().charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{it.student_name ?? '—'}</Text>
          {it.student_code ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{it.student_code}</Text> : null}
        </View>
      </View>

      {/* Which group — «which schedule master is that». */}
      {(it.groups ?? []).length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
          {(it.groups ?? []).map((g) => (
            <View key={`${g.course_id}-${g.schedule_id ?? 0}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Icon name="calendar" size={12} color={colors.textSecondary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{g.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {sameNumber ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm }}>
          <Icon name="warning" size={14} color={colors.danger} />
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>{t('staff_ui.phone_same_number')}</Text>
        </View>
      ) : null}

      <NumberLine label={t('teacher.student_number')} phone={it.student_phone ?? (studentRow?.phone ?? null)} ok={studentRow ? false : !!it.student_phone_confirmed} />
      {studentRow ? <Actions it={studentRow} /> : null}
      <NumberLine label={rel ? t('staff_ui.phone_parent_number_rel', { rel }) : t('staff_ui.phone_parent_number')} sub={it.parent_name ?? parentRow?.subject_name ?? null}
        phone={it.parent_phone ?? (parentRow?.phone ?? null)} ok={parentRow ? false : !!it.parent_phone_confirmed} />
      {parentRow ? <Actions it={parentRow} /> : null}
    </View>
  );
}

function NumberLine({ label, sub, phone, ok }: { label: string; sub?: string | null; phone: string | null; ok: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.md, marginTop: spacing.md }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ok ? colors.successLight : colors.warningLight, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name="phone" size={16} color={ok ? colors.success : colors.warningText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }} numberOfLines={1}>{label}{sub ? ` — ${sub}` : ''}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, writingDirection: 'ltr', textAlign: 'left', marginTop: 1 }}>{phone ?? '—'}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: ok ? colors.successLight : colors.warningLight }}>
        <Icon name={ok ? 'success' : 'warning'} size={12} color={ok ? colors.success : colors.warningText} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: ok ? colors.success : colors.warningText }}>{t(ok ? 'staff_ui.phone_status_ok' : 'staff_ui.phone_status_needs')}</Text>
      </View>
    </View>
  );
}
