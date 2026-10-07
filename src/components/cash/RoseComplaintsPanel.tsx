import { memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { RoseStamp } from '@/components/rose/RoseStamp';
import { useRose } from '@/hooks/useRose';
import { useComplaints } from '@/hooks/useComplaints';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';
import { formatMark } from '@/utils/markInput';
import { formatEGP } from '@/utils/currency';
import { timeAgo } from '@/utils/format';
import type { Complaint } from '@/api/complaints';

/**
 * «الاعتراضات» on مدام روز's desk (founder 2026-10-07: her tab carries more than the cash
 * count). Her ledger view of the complaints book: what waits for a decision, what an
 * assistant decided and the teacher has not yet seen, and the last decisions — each of those
 * under her red stamp, because a decision is RECORDED in her book whichever way it went.
 *
 * She records; she never decides. Every row opens the complaints screen, where the decision
 * flows (mark, amount, receiver) live — nothing is duplicated here.
 */
export function RoseComplaintsPanel() {
  const { t } = useTranslation();
  const rose = useRose();
  const { isAssistant } = useActiveAbilities();
  const pending = useComplaints('pending');
  const review = useComplaints('review', !isAssistant);
  const history = useComplaints('history');
  const open = () => router.push('/(teacher)/complaints' as Href);

  const pendingRows = pending.data?.rows ?? [];
  const reviewRows = review.data?.rows ?? [];
  const decided = (history.data?.rows ?? []).filter((c) => c.status !== 'pending').slice(0, 5);
  const loading = pending.isLoading || history.isLoading || (!isAssistant && review.isLoading);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Icon name="note" size={16} color={colors.textTertiary} outline />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{t('cash.complaints_line', { rose: rose.name })}</Text>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} /> : null}

      {!loading && pendingRows.length === 0 && reviewRows.length === 0 ? (
        <View style={{ marginBottom: spacing.md }}>
          <EmptyState icon="success" title={t('cash.complaints_none')} />
        </View>
      ) : null}

      {pendingRows.length > 0 ? (
        <Section title={t('cash.complaints_pending_title')} count={pendingRows.length} tint={colors.warning}>
          {pendingRows.map((c) => <Row key={c.id} c={c} onPress={open} />)}
        </Section>
      ) : null}

      {reviewRows.length > 0 ? (
        <Section title={t('cash.complaints_review_title')} count={reviewRows.length} tint={colors.brand}>
          {reviewRows.map((c) => <Row key={c.id} c={c} onPress={open} stamped />)}
        </Section>
      ) : null}

      {decided.length > 0 ? (
        <Section title={t('cash.complaints_recent')}>
          {decided.map((c) => <Row key={c.id} c={c} onPress={open} stamped />)}
        </Section>
      ) : null}

      <TouchableOpacity onPress={open} activeOpacity={0.85} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, borderStyle: 'dashed', marginBottom: spacing.md }}>
        <Icon name="note" size={18} color={colors.brand} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('cash.complaints_open')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Section({ title, count, tint, children }: { title: string; count?: number; tint?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary }}>{title}</Text>
        {count ? (
          <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: tint ?? colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{count}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** One complaint as she notes it: who, about what, when — and her red stamp once decided. */
const Row = memo(function Row({ c, onPress, stamped = false }: { c: Complaint; onPress: () => void; stamped?: boolean }) {
  const { t } = useTranslation();
  const isAttendance = c.type === 'attendance';
  const isGrade = c.type === 'grade';
  const tint = isAttendance ? colors.warningDark : isGrade ? colors.info : colors.accent;
  const says = isAttendance
    ? t(c.claim === 'present' ? 'complaints.says_present' : 'complaints.says_absent')
    : isGrade
      ? (c.claimed_mark !== null && c.claimed_mark !== undefined ? t('complaints.grade.says_mark', { mark: formatMark(c.claimed_mark) }) : t('complaints.grade.says_no_mark'))
      : c.claimed_amount !== null && c.claimed_amount !== undefined
        ? t('complaints.says_paid_amount', { amount: formatEGP(c.claimed_amount), method: c.paid_method ? t(`complaints.paid_${c.paid_method}`) : '' }).trim()
        : t('complaints.says_paid');
  const about = isGrade ? c.exam_title : isAttendance ? c.course_name : c.invoice_number ? t('complaints.payment_label', { number: c.invoice_number, amount: formatEGP(c.invoice_amount ?? 0) }) : null;
  const when = c.status === 'pending' ? c.created_at : c.decided_at;
  const decidedLine = c.status !== 'pending'
    ? `${t(`complaints.status_${c.status}`)} · ${c.decided_by_teacher ? t('complaints.decided_by', { name: c.decided_by_name ?? '' }) : `${t('complaints.by_assistant')} · ${c.decided_by_name ?? ''}`}`
    : null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button"
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.sm }}>
      <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: tint }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>
          {c.student_name ?? '—'}
          {about ? <Text style={{ fontFamily: fonts.regular, color: colors.textSecondary }}> · {about}</Text> : null}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{says}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 2 }} numberOfLines={1}>
          {decidedLine ?? t(isAttendance ? 'complaints.file_attendance' : isGrade ? 'complaints.grade.file' : 'complaints.file_payment')}{when ? ` · ${timeAgo(when)}` : ''}
        </Text>
      </View>
      {stamped && c.status !== 'pending' ? <RoseStamp ink="red" size={44} /> : <Icon name="back" size={18} color={colors.textTertiary} />}
    </TouchableOpacity>
  );
});
