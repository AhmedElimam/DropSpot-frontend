import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
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
import { acknowledgePhone, type PhoneConfirmation } from '@/api/phoneConfirmations';
import { requestStudentEdit, flagParentNumber } from '@/api/students';

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
  | { kind: 'edit'; item: PhoneConfirmation }
  | { kind: 'escalate'; item: PhoneConfirmation }
  | null;

export default function PhoneConfirmationsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { can } = useActiveAbilities();
  const { data, isLoading, refetch } = usePhoneConfirmations();
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [note, setNote] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [busy, setBusy] = useState(false);

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

  const closeSheet = () => { setSheet(null); setNote(''); setNewNumber(''); };

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
      Alert.alert('خطأ', getFriendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submitAck = (it: PhoneConfirmation) =>
    run(
      () => acknowledgePhone(it.student_id, it.scope, it.subject_id, note.trim() || undefined),
      'تم تأكيد الرقم — لن يظهر في القائمة مرة أخرى.',
    );

  const submitEdit = (it: PhoneConfirmation) => {
    const phone = newNumber.trim();
    if (phone.length < 8) {
      Alert.alert('', 'أدخل الرقم الصحيح أولًا.');
      return;
    }
    if (it.scope === 'student') {
      return run(
        () => requestStudentEdit(it.student_id, { phone, reason: 'تصحيح رقم الطالب من قائمة الأرقام التي تحتاج تأكيد' }),
        'تم إرسال التصحيح. يُطبَّق فورًا داخل مهلة تصحيح الأخطاء، وإلا فبعد مراجعة الإدارة.',
      );
    }
    // A parent's number is a login credential — attached as a proposal on an escalation,
    // which the admins verify before applying (and they re-invite the real parent).
    return run(
      () => flagParentNumber(it.student_id, {
        parent_id: it.subject_id,
        reason: note.trim() || 'رقم وليّ الأمر غير صحيح — أُرفق الرقم الصحيح',
        proposed_number: phone,
      }),
      'أُرسل الرقم الصحيح للإدارة لمراجعته قبل تطبيقه.',
    );
  };

  const submitEscalate = (it: PhoneConfirmation) => {
    if (note.trim().length < 3) {
      Alert.alert('', 'اذكر سبب البلاغ باختصار.');
      return;
    }
    return run(
      () => flagParentNumber(it.student_id, { parent_id: it.subject_id, reason: note.trim() }),
      'تم إرسال البلاغ للإدارة.',
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
              {isParent ? `رقم وليّ الأمر${it.subject_name ? ` — ${it.subject_name}` : ''}` : 'رقم الطالب'}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
              {it.reason}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, writingDirection: 'ltr' }}>
            {it.phone ?? '—'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
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
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.success }}>الرقم صحيح</Text>
          </TouchableOpacity>

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
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>تعديل الرقم</Text>
            </TouchableOpacity>
          ) : null}

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
        </View>
      </View>
    );
  };

  const sheetTitle = sheet?.kind === 'ack' ? 'تأكيد صحة الرقم'
    : sheet?.kind === 'edit' ? 'تعديل الرقم'
      : 'إبلاغ الإدارة';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
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
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>أرقام تحتاج تأكيد</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {groups.length === 0 ? (
            <EmptyState
              icon="success"
              title="كل الأرقام مؤكَّدة"
              message="لا توجد أرقام بانتظار التأكيد على طلابك."
            />
          ) : (
            <>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 }}>
                أرقام لم يُثبت أصحابها ملكيتها بعد. لا يمنع ذلك الحضور ولا التحصيل — لكنه يمنع
                وصول رسائل التفعيل والإشعارات للأسرة.
              </Text>
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

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={closeSheet}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSheet} />
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
            padding: spacing.xxl, paddingBottom: spacing.xl5,
          }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.xl }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{sheetTitle}</Text>

            {sheet?.kind === 'ack' ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }}>
                أنت تؤكّد أن هذا الرقم صحيح رغم عدم تأكيده برسالة — مثلًا لأن الأسرة لا تملك
                هاتفًا يستقبل الرسائل. سيُسجَّل التأكيد باسمك، ولن يظهر الرقم في القائمة مجددًا.
              </Text>
            ) : null}
            {sheet?.kind === 'edit' ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }}>
                {sheet.item.scope === 'student'
                  ? 'يُطبَّق التصحيح فورًا داخل مهلة تصحيح الأخطاء، وبعدها يمرّ على مراجعة الإدارة.'
                  : 'رقم وليّ الأمر بيانات دخول — يُرسَل الرقم الصحيح للإدارة لتتحقق منه قبل تطبيقه.'}
              </Text>
            ) : null}
            {sheet?.kind === 'escalate' ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }}>
                بلاغ بأن الرقم غير صحيح. بعد تأكيد الإدارة يظهر التنبيه لكل معلم يشارك هذا الطالب.
              </Text>
            ) : null}

            {sheet?.kind === 'edit' ? (
              <TextInput
                value={newNumber}
                onChangeText={setNewNumber}
                keyboardType="phone-pad"
                placeholder="الرقم الصحيح"
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
              placeholder={sheet?.kind === 'escalate' ? 'سبب البلاغ' : 'ملاحظة (اختياري)'}
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
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary }}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!sheet) return;
                  if (sheet.kind === 'ack') submitAck(sheet.item);
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
                    {sheet?.kind === 'ack' ? 'تأكيد' : sheet?.kind === 'edit' ? 'إرسال' : 'إبلاغ'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
