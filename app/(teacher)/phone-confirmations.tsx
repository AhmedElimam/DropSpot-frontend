import { SheetModal } from '@/components/ui/SheetModal';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { Alert } from '@/ui/dialog';
import { ScrollView } from '@/components/ui/Refreshable';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
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
  const { can } = useActiveAbilities();
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

  // Grouped by student so a family with two unverified numbers reads as one problem,
  // not two rows the teacher has to connect themselves.
  const groups = useMemo(() => {
    const by = new Map<number, { name: string | null; code: string | null; rows: PhoneConfirmation[] }>();
    for (const it of items) {
      const g = by.get(it.student_id) ?? { name: it.student_name, code: it.student_code, rows: [] };
      g.rows.push(it);
      by.set(it.student_id, g);
    }
    return Array.from(by.entries());
  }, [items]);

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

  const Row = ({ it }: { it: PhoneConfirmation }) => {
    const isParent = it.scope === 'parent';
    return (
      <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.md, marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: isParent ? colors.warningLight : colors.brandTint,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Icon name="phone" size={16} color={isParent ? colors.warningText : colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
              {isParent ? (it.subject_name ? t('staff_ui.phone_parent_number_named', { name: it.subject_name }) : t('staff_ui.phone_parent_number')) : t('teacher.student_number')}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
              {it.reason}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, writingDirection: 'ltr' }}>
            {it.phone ?? '—'}
          </Text>
        </View>

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
          <Icon name="call" size={16} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('staff_ui.phone_confirm_by_code')}</Text>
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

          <Surface id="teacher.phone_confirmations.edit_number">
          {(it.scope === 'student' ? can(ABILITY.MANAGE_STUDENTS) : can(ABILITY.REPORT_INCIDENTS)) ? (
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
          ) : null}
          </Surface>

          <Surface id="teacher.phone_confirmations.escalate">
          {it.can_escalate && can(ABILITY.REPORT_INCIDENTS) ? (
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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {groups.length === 0 ? (
            <EmptyState
              icon="success"
              title={t('staff_ui.phone_all_confirmed')}
              message={t('staff_ui.phone_none_pending')}
            />
          ) : (
            <>
              <Surface id="teacher.phone_confirmations.intro">
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 }}>
                {t('staff_ui.phone_intro')}
              </Text>
              </Surface>
              {groups.map(([studentId, g]) => (
                <View
                  key={studentId}
                  style={{
                    backgroundColor: colors.surface, borderRadius: radius.xl,
                    borderWidth: 1, borderColor: colors.border,
                    padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>
                      {g.name ?? '—'}
                    </Text>
                    {g.code ? (
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{g.code}</Text>
                    ) : null}
                  </View>
                  {g.rows.map((it) => <Row key={it.id} it={it} />)}
                </View>
              ))}
            </>
          )}
        </ScrollView>
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
