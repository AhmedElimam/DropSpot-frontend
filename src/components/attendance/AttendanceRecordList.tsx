import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { AttendanceRecordRow } from '@/components/attendance/AttendanceRecordRow';
import { formatDate, formatNumber } from '@/utils/format';
import type { AttendanceRecord } from '@/types/attendance';
import type { Complaint } from '@/api/complaints';

export type RecordFilter = 'all' | 'present' | 'absent' | 'excused';
const FILTERS: { key: RecordFilter; label: string; match: (status: string | null | undefined) => boolean }[] = [
  { key: 'all', label: 'attendance.filter_all', match: () => true },
  { key: 'present', label: 'attendance.filter_present', match: (st) => st === 'present' || st === 'late' },
  { key: 'absent', label: 'attendance.filter_absent', match: (st) => st === 'absent' },
  { key: 'excused', label: 'attendance.filter_excused', match: (st) => st === 'excused' },
];

/**
 * The attendance record as a list: filter chips with counts, rows grouped by month, a
 * show-more toggle and the dispute hint. One component so the attendance page, the
 * teacher page and the parent's child page read the same record.
 */
export function AttendanceRecordList({ records, complaintsBySession, onComplain, limit = 8, filters = true, hint = true, emptyText }: {
  records: AttendanceRecord[];
  complaintsBySession?: Map<number, Complaint>;
  onComplain?: (r: AttendanceRecord) => void;
  limit?: number;
  filters?: boolean;
  hint?: boolean;
  emptyText?: string;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<RecordFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const all = records.filter(Boolean);
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const filtered = filter === 'all' ? all : all.filter((r) => active.match(r.status));
  const visible = expanded ? filtered : filtered.slice(0, limit);

  const groups = useMemo(() => {
    const out: { key: string; label: string; rows: AttendanceRecord[] }[] = [];
    for (const r of visible) {
      const d = r.session_time ? new Date(r.session_time) : null;
      const ok = d && !isNaN(d.getTime());
      const key = ok ? `${d.getFullYear()}-${d.getMonth()}` : 'unknown';
      const label = ok ? formatDate(d, { month: 'long', year: 'numeric' }) : '—';
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(r); else out.push({ key, label, rows: [r] });
    }
    return out;
  }, [visible]);

  return (
    <View>
      {filters ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const n = f.key === 'all' ? all.length : all.filter((r) => f.match(r.status)).length;
            const tone = f.key === 'present' ? colors.success : f.key === 'absent' ? colors.danger : f.key === 'excused' ? colors.info : colors.primary;
            return (
              <TouchableOpacity key={f.key} onPress={() => { setFilter(f.key); setExpanded(false); }} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: on ? tone : colors.surfaceSunken, borderWidth: 1, borderColor: on ? tone : colors.border }}>
                {f.key !== 'all' ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: on ? colors.onPrimary : tone }} /> : null}
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? colors.onPrimary : colors.textSecondary }}>{t(f.label)}</Text>
                <View style={{ minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.22)' : colors.surface }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: on ? colors.onPrimary : colors.textTertiary }}>{formatNumber(n)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {visible.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="calendar" size={22} color={colors.textTertiary} outline />
          </View>
          <Text style={[textPresets.bodySmall, { color: colors.textTertiary, textAlign: 'center' }]}>
            {emptyText ?? t(all.length === 0 ? 'attendance.no_records' : 'attendance.no_records_filtered')}
          </Text>
        </View>
      ) : groups.map((g) => (
        <View key={g.key}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textTertiary }}>{g.label}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.borderLight }} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }}>{formatNumber(g.rows.length)}</Text>
          </View>
          {g.rows.map((record, i) => (
            <AttendanceRecordRow
              key={record.id || `${g.key}-${i}`}
              record={record}
              complaint={record.session_instance_id ? complaintsBySession?.get(record.session_instance_id) : undefined}
              onComplain={onComplain}
              last={i === g.rows.length - 1}
            />
          ))}
        </View>
      ))}

      {filtered.length > limit ? (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.85} accessibilityRole="button"
          style={{ marginTop: spacing.sm, minHeight: 42, borderRadius: radius.md, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
          <Icon name={expanded ? 'up' : 'down'} size={16} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>
            {expanded ? t('attendance.show_less') : t('attendance.show_more', { count: formatNumber(filtered.length - limit) })}
          </Text>
        </TouchableOpacity>
      ) : null}
      {hint && all.length > 0 && onComplain ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
          <Icon name="info" size={14} color={colors.textTertiary} outline />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('attendance.dispute_hint')}</Text>
        </View>
      ) : null}
    </View>
  );
}
