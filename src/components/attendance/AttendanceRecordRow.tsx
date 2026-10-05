import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ComplaintPill } from '@/components/student/ComplaintSheet';
import { formatDate, formatTime } from '@/utils/format';
import type { AttendanceRecord } from '@/types/attendance';
import type { Complaint } from '@/api/complaints';

/** The colour a record's status paints its date tile with. */
export function statusTone(status: string | null | undefined): { fg: string; bg: string } {
  switch (status) {
    case 'present': return { fg: colors.successText, bg: colors.successLight };
    case 'late': return { fg: colors.warningText, bg: colors.warningLight };
    case 'excused': return { fg: colors.infoText, bg: colors.infoLight };
    case 'absent': return { fg: colors.dangerText, bg: colors.dangerLight };
    default: return { fg: colors.textTertiary, bg: colors.surfaceSunken };
  }
}

/**
 * One attendance record as the student (and the parent, for a child) reads it: a date
 * tile tinted by the outcome, the course and who taught it, the outcome badge, how it
 * was recorded, and — when the record can be disputed — the «اعتراض» link or the state of
 * the complaint already filed on it. Shared by the student check-in page and the parent's
 * child page so both sides read the same row (founder 2026-10-03).
 */
export const AttendanceRecordRow = memo(function AttendanceRecordRow({ record, complaint, onComplain, last }: {
  record: AttendanceRecord;
  complaint?: Complaint | null;
  /** Present when this reader may dispute the record. */
  onComplain?: (record: AttendanceRecord) => void;
  last?: boolean;
}) {
  const { t } = useTranslation();
  const tone = statusTone(record.status);
  const when = record.session_time ? new Date(record.session_time) : null;
  const valid = when && !isNaN(when.getTime());
  const attended = record.status === 'present' || record.status === 'late';

  const icon = record.status === 'present' ? 'present' : record.status === 'late' ? 'late' : record.status === 'excused' ? 'excused' : 'absent';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderLight }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <Icon name={icon} size={18} color={tone.fg} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{record.course_name ?? '—'}</Text>
          <StatusBadge status={record.status ?? ''} size="sm" />
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {[valid ? formatDate(when, { weekday: 'long', day: 'numeric', month: 'short' }) : null, valid ? formatTime(when) : null, record.teacher_name].filter(Boolean).join(' · ')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 }}>
          {attended && record.check_in_method ? <StatusBadge status={record.check_in_method} size="sm" /> : null}
          {complaint ? (
            <ComplaintPill status={complaint.status} />
          ) : onComplain && record.session_instance_id ? (
            <TouchableOpacity onPress={() => onComplain(record)} hitSlop={6} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="note" size={13} color={colors.brand} outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('complaints.file_attendance')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {complaint?.status === 'rejected' && complaint.decision_note ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 4 }} numberOfLines={2}>«{complaint.decision_note}»</Text>
        ) : null}
      </View>
    </View>
  );
});
