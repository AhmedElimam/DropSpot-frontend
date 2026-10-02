import { SheetModal } from '@/components/ui/SheetModal';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { DayMarker } from '@/components/session/DayMarker';
import { useTeacherSessionsWindow } from '@/hooks/useTeacherSessionHistory';
import { formatNumber } from '@/utils/format';
import { DAY_SHORT, WEEK_ORDER, PHASE_DOT, dayKey, phasesByDay } from '@/utils/sessionDays';
import type { SessionPhase } from '@/utils/sessionPhase';

const MONTH_FMT = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' });
const LEGEND: SessionPhase[] = ['live', 'upcoming', 'done', 'cancelled'];
const LEGEND_KEY: Record<SessionPhase, string> = {
  live: 'teacher.live_now', upcoming: 'session_ui.upcoming', done: 'session.completed', cancelled: 'session.cancelled',
};

/**
 * Jump to any day: a month calendar (Saturday first) with the same day markers as the
 * week strip, so a teacher sees at a glance which days had sessions, which are coming and
 * which were cancelled. One request per month shown (the server's ≤31-day window).
 */
export function SessionMonthPicker({
  visible, value, now, onPick, onClose,
}: { visible: boolean; value: Date; now: number; onPick: (d: Date) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  useEffect(() => { if (visible) setMonth(new Date(value.getFullYear(), value.getMonth(), 1)); }, [visible, value]);

  const first = month;
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const q = useTeacherSessionsWindow(dayKey(first), dayKey(last), visible);
  const phases = useMemo(() => phasesByDay(q.data?.items ?? [], now), [q.data, now]);

  // Leading blanks so the 1st lands under its weekday (Saturday-first columns).
  const cells = useMemo(() => {
    const lead = WEEK_ORDER.indexOf(first.getDay());
    const out: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= last.getDate(); d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayKey = dayKey(new Date(now));
  const selectedKey = dayKey(value);
  const monthTotal = (q.data?.items ?? []).length;
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <SheetModal visible={visible} onClose={onClose} style={{ backgroundColor: colors.background, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>

          {/* Month bar — earlier months to the right (RTL). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity onPress={() => shift(-1)} hitSlop={8} accessibilityLabel={t('session_ui.prev_month')} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="forward" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{MONTH_FMT.format(month)}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
                {q.isFetching && !q.data ? ' ' : t('session_ui.month_total', { n: formatNumber(monthTotal) })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => shift(1)} hitSlop={8} accessibilityLabel={t('session_ui.next_month')} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
            {WEEK_ORDER.map((d) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>{DAY_SHORT[d]}</Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs, opacity: q.isPlaceholderData ? 0.5 : 1 }}>
            {cells.map((d, i) => {
              if (!d) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 54 }} />;
              const k = dayKey(d);
              const on = k === selectedKey;
              const isToday = k === todayKey;
              return (
                <View key={k} style={{ width: `${100 / 7}%`, height: 54, padding: 2 }}>
                  <TouchableOpacity onPress={() => { onPick(d); onClose(); }} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={{ flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brand : phases.has(k) ? colors.surface : 'transparent', borderWidth: isToday && !on ? 1.5 : 0, borderColor: colors.accent }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: on ? '#fff' : colors.textPrimary }}>{formatNumber(d.getDate())}</Text>
                    <DayMarker phases={phases.get(k)} tone="light" selected={false} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          {q.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} /> : null}

          {/* Legend — what a dot means. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md, marginTop: spacing.md }}>
            {LEGEND.map((p) => (
              <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PHASE_DOT.light[p] }} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t(LEGEND_KEY[p])}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity onPress={() => { onPick(new Date(now)); onClose(); }} activeOpacity={0.85}
            style={{ marginTop: spacing.lg, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
            <Icon name="calendar" size={18} color={colors.onAccent} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onAccent }}>{t('session_ui.go_today')}</Text>
          </TouchableOpacity>
    </SheetModal>
  );
}
