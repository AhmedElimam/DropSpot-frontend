import { memo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { Alert } from '@/ui/dialog';
import { FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHero } from '@/components/ui/PageHero';
import { SheetModal } from '@/components/ui/SheetModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/layout/Avatar';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useComplaints, useComplaintDecision } from '@/hooks/useComplaints';
import { useAuthStore } from '@/stores/authStore';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { AnnotatedPhoto } from '@/components/complaints/AnnotatedPhoto';
import { RoseStamp, useStampBurst } from '@/components/rose/RoseStamp';
import { useRose } from '@/hooks/useRose';
import { cleanMarkInput, formatMark, parseMarkInput } from '@/utils/markInput';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatDate, formatNumber, timeAgo } from '@/utils/format';
import { formatEGP } from '@/utils/currency';
import { ledgerMethodFor, type Complaint, type ComplaintBucket, type LedgerMethod } from '@/api/complaints';

/**
 * «الاعتراضات» — the staff bucket (founder 2026-10-03). Three segments: what waits for a
 * decision, what an ASSISTANT decided and the teacher has not yet seen (teacher only), and
 * the recent record. Approving applies the correction (a mark, a payment recorded, or a
 * grade rewritten); an assistant sees only the kinds their abilities let them decide.
 *
 * Grade complaints («اعتراض على الدرجة», 2026-10-05) carry the recorded and claimed marks
 * and the family's photo of the paper with what they drew on it. Approving one asks for the
 * corrected mark. A merged-exam grade is the teacher's alone (the server answers an
 * assistant TEACHER_ONLY), so an assistant never sees decide buttons on those rows.
 *
 * A payment complaint is recorded like any payment (founder review 2026-10-05): approving
 * confirms the AMOUNT really paid (a part, for a part-paid invoice), CASH or a TRANSFER, and
 * for cash WHO received it. A transfer enters no drawer; cash enters the receiver's drawer.
 */
export default function ComplaintsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const abilities = useActiveAbilities();
  const isAssistant = abilities.isAssistant || user?.user_type_id === 6;
  const [bucket, setBucket] = useState<ComplaintBucket>('pending');
  const q = useComplaints(bucket);
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);
  const { approve, reject, review } = useComplaintDecision();
  // A decision lands in مدام روز's book: her red stamp flashes, whichever way it went (founder 2026-10-07).
  const rose = useRose();
  const { burst, burstNode } = useStampBurst();
  const stamped = () => { burst('red', t('complaints.stamp_decided', { rose: rose.name })); };
  const [rejecting, setRejecting] = useState<Complaint | null>(null);
  const [note, setNote] = useState('');
  // Approving a grade complaint: the corrected mark, prefilled with what was asked for.
  const [grading, setGrading] = useState<Complaint | null>(null);
  const [markText, setMarkText] = useState('');
  // Approving a payment: the amount, cash or transfer, and for cash who received it.
  const [paying, setPaying] = useState<Complaint | null>(null);
  const [payText, setPayText] = useState('');
  const [payMethod, setPayMethod] = useState<LedgerMethod | null>(null);
  const [payReceiver, setPayReceiver] = useState<number | null>(null);

  const counts = q.data?.counts ?? { pending: 0, review: 0 };
  const can = q.data?.can_decide ?? { attendance: false, payment: false, grade: false };
  const receivers = q.data?.receivers ?? [];
  const canDecideRow = (c: Complaint) =>
    c.type === 'attendance' ? can.attendance
      : c.type === 'payment' ? can.payment
        : can.grade && !(isAssistant && c.grade_source === 'revision');
  const segments: { key: ComplaintBucket; label: string; badge?: number }[] = [
    { key: 'pending', label: t('complaints.bucket_pending'), badge: counts.pending },
    ...(!isAssistant ? [{ key: 'review' as ComplaintBucket, label: t('complaints.bucket_review'), badge: counts.review }] : []),
    { key: 'history', label: t('complaints.bucket_history') },
  ];

  const confirmApprove = (c: Complaint) => {
    if (c.type === 'grade') {
      const start = c.claimed_mark ?? c.recorded_mark;
      setMarkText(start !== null && start !== undefined ? formatMark(start) : '');
      setGrading(c);
      return;
    }
    if (c.type === 'payment') {
      const start = c.claimed_amount ?? c.invoice_remaining ?? null;
      setPayText(start !== null && start !== undefined ? formatMark(start) : '');
      setPayMethod(ledgerMethodFor(c.paid_method));
      setPayReceiver(receivers.find((r) => r.is_me)?.id ?? null);
      setPaying(c);
      return;
    }
    const claimLabel = c.claim === 'present' ? t('attendance.present') : t('attendance.absent');
    Alert.alert(
      t('complaints.approve'),
      c.type === 'attendance' ? t('complaints.approve_confirm_attendance', { claim: claimLabel }) : t('complaints.approve_confirm_payment'),
      [{ text: t('common.cancel'), style: 'cancel' }, { text: t('complaints.approve'), onPress: () => approve.mutate({ id: c.id }, { onSuccess: stamped, onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)) }) }],
    );
  };
  const sendReject = () => {
    if (!rejecting) return;
    reject.mutate({ id: rejecting.id, note: note.trim() || undefined }, {
      onSuccess: () => { setRejecting(null); setNote(''); stamped(); },
      onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
    });
  };

  const gradeMax = grading?.max_mark ?? null;
  const markValue = parseMarkInput(markText);
  const markError = !grading || !markText.trim()
    ? null
    : markValue === null || markValue < 0
      ? t('complaints.grade.mark_min')
      : gradeMax !== null && markValue > gradeMax
        ? t('complaints.grade.mark_range', { max: formatMark(gradeMax) })
        : null;
  const canApproveMark = !!grading && markValue !== null && !markError && !approve.isPending;
  const sendGrade = () => {
    if (!grading || !canApproveMark || markValue === null) return;
    approve.mutate({ id: grading.id, mark: markValue }, {
      onSuccess: () => { setGrading(null); setMarkText(''); stamped(); },
      onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
    });
  };

  const payDue = paying?.invoice_remaining ?? null;
  const payValue = parseMarkInput(payText);
  const payError = !paying || !payText.trim()
    ? null
    : payValue === null || payValue <= 0
      ? t('complaints.amount_min')
      : payDue !== null && payValue > payDue + 0.001
        ? t('complaints.amount_max', { amount: formatEGP(payDue) })
        : null;
  const canApprovePay = !!paying && payValue !== null && payValue > 0 && !payError && !!payMethod
    && (payMethod !== 'cash' || payReceiver !== null) && !approve.isPending;
  const sendPayment = () => {
    if (!paying || !canApprovePay || payValue === null || !payMethod) return;
    approve.mutate({ id: paying.id, amount: payValue, method: payMethod, received_by: payMethod === 'cash' ? payReceiver ?? undefined : undefined }, {
      onSuccess: () => { setPaying(null); setPayText(''); stamped(); },
      onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
    });
  };

  const rows = q.data?.rows ?? [];
  const busyId = approve.isPending ? approve.variables?.id : reject.isPending ? reject.variables?.id : review.isPending ? review.variables : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHero
        title={t('complaints.title')}
        subtitle={t('complaints.manage_sub')}
        onBack
        stats={[
          { value: formatNumber(counts.pending), label: t('complaints.bucket_pending'), warn: counts.pending > 0 },
          ...(!isAssistant ? [{ value: formatNumber(counts.review), label: t('complaints.bucket_review'), warn: counts.review > 0 }] : []),
        ]}
      />
      <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.full, padding: 4, borderWidth: 1, borderColor: colors.border }}>
          {segments.map((s) => {
            const on = bucket === s.key;
            return (
              <TouchableOpacity key={s.key} onPress={() => setBucket(s.key)} activeOpacity={0.9} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.full, backgroundColor: on ? colors.primary : 'transparent' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.onPrimary : colors.textSecondary }}>{s.label}</Text>
                {s.badge ? (
                  <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: on ? colors.onPrimary : colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: on ? colors.primary : colors.onAccent }}>{formatNumber(s.badge)}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {bucket === 'review' ? (
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.infoLight, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Icon name="info" size={18} color={colors.infoText} outline />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.infoText }}>{t('complaints.review_hint')}</Text>
        </View>
      ) : null}

      {q.isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl4 }} />
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          data={rows}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="note" title={t(`complaints.empty_${bucket}`)} />}
          renderItem={({ item }) => (
            <ComplaintRow
              c={item}
              bucket={bucket}
              canDecide={canDecideRow(item)}
              busy={busyId === item.id}
              onApprove={() => confirmApprove(item)}
              onReject={() => { setRejecting(item); setNote(''); }}
              onReview={() => review.mutate(item.id, { onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)) })}
            />
          )}
        />
      )}

      {/* Reject with a reason the student will read. */}
      <SheetModal visible={!!rejecting} onClose={() => setRejecting(null)} avoidKeyboard style={{ backgroundColor: colors.surface }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('complaints.reject_note_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md }}>{t('complaints.reject_note_hint')}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          autoFocus
          placeholder={t('complaints.reject_note_hint')}
          placeholderTextColor={colors.textTertiary}
          style={{ minHeight: 84, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top' }}
        />
        <TouchableOpacity onPress={sendReject} disabled={reject.isPending} activeOpacity={0.85}
          style={{ marginTop: spacing.md, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, opacity: reject.isPending ? 0.6 : 1 }}>
          {reject.isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="close" size={18} color={colors.onPrimary} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>{t('complaints.reject')}</Text>
        </TouchableOpacity>
      </SheetModal>

      {/* Approve a grade: the corrected mark (0..max), prefilled with what the family asked for. */}
      <SheetModal visible={!!grading} onClose={() => setGrading(null)} avoidKeyboard style={{ backgroundColor: colors.surface }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('complaints.grade.approve_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md }}>
          {grading ? `${grading.student_name ?? ''} · ${grading.exam_title ?? ''}\n${t('complaints.grade.approve_hint', { from: formatMark(grading.recorded_mark) })}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TextInput
            value={markText}
            onChangeText={(v) => setMarkText(cleanMarkInput(v).slice(0, 7))}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            style={{ flex: 1, height: 56, backgroundColor: colors.surfaceSunken, borderWidth: 1.5, borderColor: markError ? colors.danger : colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, textAlign: 'center' }}
          />
          {gradeMax !== null ? <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textTertiary }}>/ {formatMark(gradeMax)}</Text> : null}
        </View>
        {markError ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.dangerText, marginTop: spacing.xs }}>{markError}</Text>
        ) : grading && markValue !== null ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.xs }}>{t('complaints.grade.approve_change', { from: formatMark(grading.recorded_mark), to: formatMark(markValue) })}</Text>
        ) : null}
        <TouchableOpacity onPress={sendGrade} disabled={!canApproveMark} activeOpacity={0.85} accessibilityRole="button"
          style={{ marginTop: spacing.md, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, opacity: approve.isPending ? 0.6 : canApproveMark ? 1 : 0.5 }}>
          {approve.isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="success" size={18} color={colors.onPrimary} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>{t('complaints.grade.approve_confirm')}</Text>
        </TouchableOpacity>
      </SheetModal>

      {/* Approve a payment: what was really paid, how, and — for cash — whose drawer it is in. */}
      <SheetModal visible={!!paying} onClose={() => setPaying(null)} avoidKeyboard style={{ backgroundColor: colors.surface }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('complaints.approve_payment_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md }}>
          {paying ? `${paying.student_name ?? ''} · ${t('complaints.payment_label', { number: paying.invoice_number ?? '—', amount: formatEGP(paying.invoice_amount ?? 0) })}\n${t('complaints.approve_payment_hint')}` : ''}
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('complaints.paid_how_much')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TextInput
            value={payText}
            onChangeText={(v) => setPayText(cleanMarkInput(v).slice(0, 9))}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel={t('complaints.paid_how_much')}
            style={{ flex: 1, height: 54, backgroundColor: colors.surfaceSunken, borderWidth: 1.5, borderColor: payError ? colors.danger : colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, fontFamily: fonts.bold, fontSize: 21, color: colors.textPrimary, textAlign: 'center' }}
          />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textTertiary }}>{t('complaints.currency')}</Text>
        </View>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: payError ? colors.dangerText : colors.textSecondary, marginTop: spacing.xs }}>
          {payError ?? (payDue !== null ? t('complaints.still_due', { amount: formatEGP(payDue) }) : '')}
        </Text>

        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs }}>{t('complaints.method_label')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['cash', 'digital'] as LedgerMethod[]).map((m) => {
            const on = payMethod === m;
            return (
              <TouchableOpacity key={m} onPress={() => setPayMethod(m)} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected: on }}
                style={{ flex: 1, minHeight: 46, borderRadius: radius.lg, borderWidth: on ? 2 : 1, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? `${colors.accent}1A` : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.accent : colors.textSecondary, textAlign: 'center' }} numberOfLines={2}>{t(`complaints.method_${m}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {payMethod === 'cash' && receivers.length > 0 ? (
          <>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs }}>{t('complaints.received_by_label')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {receivers.map((r) => {
                const on = payReceiver === r.id;
                return (
                  <TouchableOpacity key={r.id} onPress={() => setPayReceiver(r.id)} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected: on }}
                    style={{ minHeight: 40, borderRadius: radius.full, borderWidth: on ? 2 : 1, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? `${colors.accent}1A` : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.accent : colors.textSecondary }} numberOfLines={1}>{r.is_me ? t('complaints.receiver_me') : r.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        <TouchableOpacity onPress={sendPayment} disabled={!canApprovePay} activeOpacity={0.85} accessibilityRole="button"
          style={{ marginTop: spacing.lg, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, opacity: approve.isPending ? 0.6 : canApprovePay ? 1 : 0.5 }}>
          {approve.isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="success" size={18} color={colors.onPrimary} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>{t('complaints.approve_payment_confirm', { amount: payValue !== null ? formatEGP(payValue) : '—' })}</Text>
        </TouchableOpacity>
      </SheetModal>
      {burstNode}
    </View>
  );
}

const ComplaintRow = memo(function ComplaintRow({ c, bucket, canDecide, busy, onApprove, onReject, onReview }: {
  c: Complaint; bucket: ComplaintBucket; canDecide: boolean; busy: boolean; onApprove: () => void; onReject: () => void; onReview: () => void;
}) {
  const { t } = useTranslation();
  const isAttendance = c.type === 'attendance';
  const isGrade = c.type === 'grade';
  const tint = isAttendance ? colors.warningDark : isGrade ? colors.info : colors.accent;
  const typeLabel = t(isAttendance ? 'complaints.file_attendance' : isGrade ? 'complaints.grade.file' : 'complaints.file_payment');
  const says = isAttendance
    ? t(c.claim === 'present' ? 'complaints.says_present' : 'complaints.says_absent')
    : isGrade
      ? (c.claimed_mark !== null && c.claimed_mark !== undefined ? t('complaints.grade.says_mark', { mark: formatMark(c.claimed_mark) }) : t('complaints.grade.says_no_mark'))
      : c.claimed_amount !== null && c.claimed_amount !== undefined
        ? t('complaints.says_paid_amount', { amount: formatEGP(c.claimed_amount), method: c.paid_method ? t(`complaints.paid_${c.paid_method}`) : '' }).trim()
        : t('complaints.says_paid');
  const when = c.session_at ? ` · ${formatDate(new Date(c.session_at), { weekday: 'long', day: 'numeric', month: 'short' })}` : '';
  const subject = isAttendance
    ? `${c.course_name ?? ''}${when}`
    : isGrade
      ? `${c.exam_title ?? c.course_name ?? ''}${when}`
      : t('complaints.payment_label', { number: c.invoice_number ?? '—', amount: formatEGP(c.invoice_amount ?? 0) })
        + (c.status === 'pending' && c.invoice_remaining !== null && c.invoice_remaining !== undefined ? ` · ${t('complaints.still_due', { amount: formatEGP(c.invoice_remaining) })}` : '');
  const decided = c.status !== 'pending';
  const statusTone = c.status === 'approved' ? { bg: colors.successLight, fg: colors.successText } : c.status === 'rejected' ? { bg: colors.dangerLight, fg: colors.dangerText } : { bg: colors.warningLight, fg: colors.warningText };

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderStartWidth: 5, borderStartColor: tint, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar name={c.student_name ?? '—'} seed={avatarSeed.student(c.student_id, c.student_name ?? '—')} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{c.student_name ?? '—'}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>{subject}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ backgroundColor: `${tint}1F`, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: tint }}>{typeLabel}</Text>
          </View>
          {c.created_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{timeAgo(c.created_at)}</Text> : null}
        </View>
      </View>
      {c.filed_by_parent ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: spacing.sm, backgroundColor: colors.brandTint, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Icon name="children" size={12} color={colors.brand} outline />
          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.brand }}>{c.filed_by_name ? t('complaints.by_parent_name', { name: c.filed_by_name }) : t('complaints.by_parent')}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
          <Icon name={isAttendance ? (c.claim === 'present' ? 'present' : 'absent') : isGrade ? 'grades' : 'money'} size={14} color={colors.textSecondary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>{says}</Text>
        </View>
        {isAttendance ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('complaints.recorded', { status: '' }).replace(': ', ':')}</Text>
            {c.recorded_status ? <StatusBadge status={c.recorded_status} size="sm" /> : <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('complaints.not_recorded')}</Text>}
          </View>
        ) : isGrade ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>
            {c.max_mark !== null && c.max_mark !== undefined
              ? t('complaints.grade.recorded_of', { mark: formatMark(c.recorded_mark), max: formatMark(c.max_mark) })
              : t('complaints.grade.recorded_only', { mark: formatMark(c.recorded_mark) })}
          </Text>
        ) : null}
      </View>
      {c.note ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: spacing.sm }}>«{c.note}»</Text> : null}
      {isGrade && c.photo_url ? (
        <AnnotatedPhoto uri={c.photo_url} annotations={c.photo_annotations} height={170} style={{ marginTop: spacing.sm }} />
      ) : null}

      {decided ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
          {/* In her book — recorded, whichever way it went. */}
          <RoseStamp ink="red" size={40} />
          <View style={{ backgroundColor: statusTone.bg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: statusTone.fg }}>{t(`complaints.status_${c.status}`)}</Text>
          </View>
          {isGrade && c.status === 'approved' && c.corrected_mark !== null && c.corrected_mark !== undefined ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.successText }}>{t('complaints.grade.corrected_to', { mark: formatMark(c.corrected_mark) })}</Text>
          ) : null}
          {c.type === 'payment' && c.status === 'approved' && c.approved_amount !== null && c.approved_amount !== undefined ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.successText }}>
              {c.approved_method === 'digital'
                ? t('complaints.recorded_payment_digital', { amount: formatEGP(c.approved_amount) })
                : t('complaints.recorded_payment_cash', { amount: formatEGP(c.approved_amount), name: c.received_by_name ?? '' })}
            </Text>
          ) : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
            {c.decided_by_teacher ? t('complaints.decided_by', { name: c.decided_by_name ?? '' }) : `${t('complaints.by_assistant')} · ${c.decided_by_name ?? ''}`}
            {c.decided_at ? ` · ${timeAgo(c.decided_at)}` : ''}
          </Text>
          {c.decision_note ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, width: '100%' }}>«{c.decision_note}»</Text> : null}
          {bucket === 'review' ? (
            <TouchableOpacity onPress={onReview} disabled={busy} activeOpacity={0.85} accessibilityRole="button"
              style={{ marginStart: 'auto', height: 40, paddingHorizontal: spacing.md, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brand }}>
              {busy ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="success" size={16} color={colors.brand} />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('complaints.mark_reviewed')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : canDecide ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <TouchableOpacity onPress={onApprove} disabled={busy} activeOpacity={0.85} accessibilityRole="button"
            style={{ flex: 1, height: 46, borderRadius: radius.lg, backgroundColor: colors.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: busy ? 0.6 : 1 }}>
            {busy ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Icon name="success" size={18} color={colors.onPrimary} />}
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.onPrimary }}>{t('complaints.approve')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onReject} disabled={busy} activeOpacity={0.85} accessibilityRole="button"
            style={{ flex: 1, height: 46, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="close" size={18} color={colors.dangerText} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.dangerText }}>{t('complaints.reject')}</Text>
          </TouchableOpacity>
        </View>
      ) : isGrade ? null : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>{t('complaints.cannot_decide')}</Text>
      )}
    </View>
  );
});
