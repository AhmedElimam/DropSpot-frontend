import { memo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput } from 'react-native';
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
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatDate, formatNumber, timeAgo } from '@/utils/format';
import { formatEGP } from '@/utils/currency';
import type { Complaint, ComplaintBucket } from '@/api/complaints';

/**
 * «الاعتراضات» — the staff bucket (founder 2026-10-03). Three segments: what waits for a
 * decision, what an ASSISTANT decided and the teacher has not yet seen (teacher only), and
 * the recent record. Approving applies the correction (a mark, or the invoice marked paid);
 * an assistant sees only the kinds their abilities let them decide.
 */
export default function ComplaintsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isAssistant = user?.user_type_id === 6;
  const [bucket, setBucket] = useState<ComplaintBucket>('pending');
  const q = useComplaints(bucket);
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);
  const { approve, reject, review } = useComplaintDecision();
  const [rejecting, setRejecting] = useState<Complaint | null>(null);
  const [note, setNote] = useState('');

  const counts = q.data?.counts ?? { pending: 0, review: 0 };
  const can = q.data?.can_decide ?? { attendance: false, payment: false };
  const segments: { key: ComplaintBucket; label: string; badge?: number }[] = [
    { key: 'pending', label: t('complaints.bucket_pending'), badge: counts.pending },
    ...(!isAssistant ? [{ key: 'review' as ComplaintBucket, label: t('complaints.bucket_review'), badge: counts.review }] : []),
    { key: 'history', label: t('complaints.bucket_history') },
  ];

  const confirmApprove = (c: Complaint) => {
    const claimLabel = c.claim === 'present' ? t('attendance.present') : t('attendance.absent');
    Alert.alert(
      t('complaints.approve'),
      c.type === 'attendance' ? t('complaints.approve_confirm_attendance', { claim: claimLabel }) : t('complaints.approve_confirm_payment'),
      [{ text: t('common.cancel'), style: 'cancel' }, { text: t('complaints.approve'), onPress: () => approve.mutate(c.id, { onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)) }) }],
    );
  };
  const sendReject = () => {
    if (!rejecting) return;
    reject.mutate({ id: rejecting.id, note: note.trim() || undefined }, {
      onSuccess: () => { setRejecting(null); setNote(''); },
      onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
    });
  };

  const rows = q.data?.rows ?? [];
  const busyId = approve.isPending ? approve.variables : reject.isPending ? reject.variables?.id : review.isPending ? review.variables : null;

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
        <FlatList
          data={rows}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="note" title={t(`complaints.empty_${bucket}`)} />}
          renderItem={({ item }) => (
            <ComplaintRow
              c={item}
              bucket={bucket}
              canDecide={item.type === 'attendance' ? can.attendance : can.payment}
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
    </View>
  );
}

const ComplaintRow = memo(function ComplaintRow({ c, bucket, canDecide, busy, onApprove, onReject, onReview }: {
  c: Complaint; bucket: ComplaintBucket; canDecide: boolean; busy: boolean; onApprove: () => void; onReject: () => void; onReview: () => void;
}) {
  const { t } = useTranslation();
  const isAttendance = c.type === 'attendance';
  const tint = isAttendance ? colors.warningDark : colors.accent;
  const says = isAttendance ? t(c.claim === 'present' ? 'complaints.says_present' : 'complaints.says_absent') : t('complaints.says_paid');
  const subject = isAttendance
    ? `${c.course_name ?? ''}${c.session_at ? ` · ${formatDate(new Date(c.session_at), { weekday: 'long', day: 'numeric', month: 'short' })}` : ''}`
    : t('complaints.payment_label', { number: c.invoice_number ?? '—', amount: formatEGP(c.invoice_amount ?? 0) });
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
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: tint }}>{t(isAttendance ? 'complaints.file_attendance' : 'complaints.file_payment')}</Text>
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
          <Icon name={isAttendance ? (c.claim === 'present' ? 'present' : 'absent') : 'money'} size={14} color={colors.textSecondary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>{says}</Text>
        </View>
        {isAttendance ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('complaints.recorded', { status: '' }).replace(': ', ':')}</Text>
            {c.recorded_status ? <StatusBadge status={c.recorded_status} size="sm" /> : <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('complaints.not_recorded')}</Text>}
          </View>
        ) : null}
      </View>
      {c.note ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: spacing.sm }}>«{c.note}»</Text> : null}

      {decided ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: statusTone.bg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: statusTone.fg }}>{t(`complaints.status_${c.status}`)}</Text>
          </View>
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
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>{t('complaints.cannot_decide')}</Text>
      )}
    </View>
  );
});
