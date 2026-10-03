import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useFileComplaint } from '@/hooks/useComplaints';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatDate } from '@/utils/format';
import { formatEGP } from '@/utils/currency';
import type { ComplaintClaim } from '@/api/complaints';

/** What the student is disputing — one session's mark, or one invoice. */
export type ComplaintTarget =
  | { type: 'attendance'; sessionInstanceId: number; courseName: string; sessionAt: string | null; recordedStatus: string | null }
  | { type: 'payment'; invoiceId: number; invoiceNumber: string; amount: number };

/**
 * «اعتراض» — the student's sheet (founder 2026-10-03). Attendance: pick what really
 * happened (I was there / I was not), add a line, send. Payment: say the invoice was paid
 * and not recorded, add a line, send. Each kind lives where its record is — the session
 * list and the invoice card — so this sheet only needs the one target.
 */
export function ComplaintSheet({ visible, onClose, target }: { visible: boolean; onClose: () => void; target: ComplaintTarget | null }) {
  const { t } = useTranslation();
  const file = useFileComplaint();
  const [claim, setClaim] = useState<ComplaintClaim | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (visible) {
      setSent(false); setNote('');
      // Default to the opposite of what is recorded — that is what a dispute usually says.
      const attending = target?.type === 'attendance' && (target.recordedStatus === 'present' || target.recordedStatus === 'late');
      setClaim(target?.type === 'attendance' ? (attending ? 'absent' : 'present') : null);
      file.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, target]);

  if (!target) return null;
  const isAttendance = target.type === 'attendance';
  const canSend = !file.isPending && (!isAttendance || !!claim);

  const send = () => {
    if (!canSend) return;
    file.mutate(
      isAttendance
        ? { type: 'attendance', session_instance_id: target.sessionInstanceId, claim: claim!, note: note.trim() || undefined }
        : { type: 'payment', invoice_id: target.invoiceId, note: note.trim() || undefined },
      { onSuccess: () => setSent(true) },
    );
  };

  return (
    <SheetModal visible={visible} onClose={onClose} avoidKeyboard style={{ backgroundColor: colors.surface }}>
      {sent ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="success" size={32} color={colors.success} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('complaints.sent_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' }}>{t('complaints.sent_body')}</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={{ alignSelf: 'stretch', minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isAttendance ? colors.warningLight : colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={isAttendance ? 'attendance' : 'money'} size={22} color={isAttendance ? colors.warningDark : colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t(isAttendance ? 'complaints.file_attendance' : 'complaints.file_payment')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
                {isAttendance
                  ? `${target.courseName}${target.sessionAt ? ` · ${formatDate(new Date(target.sessionAt), { weekday: 'long', day: 'numeric', month: 'short' })}` : ''}`
                  : t('complaints.payment_label', { number: target.invoiceNumber, amount: formatEGP(target.amount) })}
              </Text>
            </View>
          </View>

          {isAttendance ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('complaints.recorded', { status: '' }).replace(': ', ':')}</Text>
                {target.recordedStatus ? <StatusBadge status={target.recordedStatus} size="sm" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary }}>{t('complaints.not_recorded')}</Text>}
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>{t('complaints.claim_hint')}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['present', 'absent'] as ComplaintClaim[]).map((c) => {
                  const on = claim === c;
                  const tint = c === 'present' ? colors.success : colors.danger;
                  return (
                    <TouchableOpacity key={c} onPress={() => setClaim(c)} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected: on }}
                      style={{ flex: 1, minHeight: 56, borderRadius: radius.lg, borderWidth: on ? 2 : 1, borderColor: on ? tint : colors.border, backgroundColor: on ? `${tint}1A` : colors.surfaceSunken, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
                      <Icon name={c === 'present' ? 'present' : 'absent'} size={20} color={on ? tint : colors.textTertiary} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: on ? tint : colors.textSecondary }}>{t(c === 'present' ? 'complaints.claim_present' : 'complaints.claim_absent')}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={{ backgroundColor: colors.infoLight, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Icon name="info" size={18} color={colors.infoText} outline />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.infoText }}>{t('complaints.payment_hint')}</Text>
            </View>
          )}

          <View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('complaints.note_label')}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('complaints.note_placeholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={1000}
              style={{ minHeight: 84, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top' }}
            />
          </View>

          {file.isError ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.dangerText }}>{getFriendlyErrorMessage(file.error)}</Text>
          ) : null}

          <TouchableOpacity onPress={send} disabled={!canSend} activeOpacity={0.85}
            style={{ minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, opacity: canSend ? 1 : 0.5 }}>
            {file.isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="send" size={18} color={colors.onPrimary} />}
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('complaints.send')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SheetModal>
  );
}

/** The small status pill a session row or invoice card shows once a complaint exists. */
export function ComplaintPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const { t } = useTranslation();
  const tone = status === 'approved' ? { bg: colors.successLight, fg: colors.successText } : status === 'rejected' ? { bg: colors.dangerLight, fg: colors.dangerText } : { bg: colors.warningLight, fg: colors.warningText };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tone.bg, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 8 }}>
      <Icon name="note" size={11} color={tone.fg} outline />
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: tone.fg }}>{t('complaints.student_title')} · {t(`complaints.status_${status}`)}</Text>
    </View>
  );
}
