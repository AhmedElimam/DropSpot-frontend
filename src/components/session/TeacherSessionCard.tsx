import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { AttendanceBar } from './AttendanceVisuals';
import { formatNumber } from '@/utils/format';

import { sessionPhase, type SessionPhase } from '@/utils/sessionPhase';

export { sessionPhase, type SessionPhase };

export interface SessionCardData {
  id: string;
  course_name: string | null;
  time: string | null;
  location: string | null;
  scheduled_at: string | null;
  duration_minutes?: number | null;
  status: string;
  cycle_position?: { n: number; of: number } | null;
  checked_in_count?: number;
  absent_count?: number;
  enrolled_count?: number;
}

const PHASE = (): Record<SessionPhase, { stripe: string; chipBg: string; chipText: string; key: string }> => ({
  live: { stripe: colors.success, chipBg: colors.success, chipText: '#fff', key: 'teacher.live_now' },
  upcoming: { stripe: colors.brand, chipBg: colors.brandTint, chipText: colors.brand, key: 'session_ui.upcoming' },
  done: { stripe: colors.borderStrong, chipBg: colors.surfaceSunken, chipText: colors.textSecondary, key: 'session.completed' },
  cancelled: { stripe: colors.danger, chipBg: colors.dangerLight, chipText: colors.dangerText, key: 'session.cancelled' },
});

/**
 * The ONE session card (Home timeline, Sessions tab): a coloured stripe on the start edge
 * says where the session stands, the time sits in its own column so a day reads as a
 * timetable, and the bar + «١٢ من ٣٠» says how full the room is. Live and upcoming cards
 * carry the two actions; a past one opens its sheet on tap.
 */
export const SessionCard = memo(function SessionCard({
  s, now, onOpen, onScan, compact = false,
}: { s: SessionCardData; now: number; onOpen: (s: SessionCardData) => void; onScan?: (s: SessionCardData) => void; compact?: boolean }) {
  const { t } = useTranslation();
  const phase = sessionPhase(s, now);
  const p = PHASE()[phase];
  const present = s.checked_in_count ?? 0;
  const absent = s.absent_count ?? 0;
  const total = s.enrolled_count ?? 0;
  const actionable = !compact && (phase === 'live' || phase === 'upcoming');
  const [clock, meridiem] = (s.time ?? '').split(' ');
  // A compact card (Home's rest of the day) is NOT tappable: it sits in a swipe row, and a
  // tap on the card opened the session while swiping. Only its «تفاصيل الحصة» button opens it
  // (founder 2026-10-04). Full cards stay tappable as a whole.
  const Shell = (compact ? View : TouchableOpacity) as typeof TouchableOpacity;
  const press = compact ? {} : { onPress: () => onOpen(s), activeOpacity: 0.85, accessibilityRole: 'button' as const };

  return (
    <Shell
      {...press}
      style={{
        flexDirection: 'row', backgroundColor: phase === 'live' ? colors.successLight : colors.surface,
        borderRadius: radius.xl, borderWidth: 1, borderColor: phase === 'live' ? colors.success : colors.border,
        borderStartWidth: 5, borderStartColor: p.stripe, overflow: 'hidden',
        opacity: phase === 'cancelled' ? 0.7 : 1, marginBottom: spacing.sm,
      }}
    >
      {/* Time column */}
      <View style={{ width: 70, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderEndWidth: 1, borderEndColor: phase === 'live' ? colors.success + '40' : colors.borderLight }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: phase === 'live' ? colors.successText : colors.textPrimary }}>{clock || '—'}</Text>
        {meridiem ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.textTertiary }}>{meridiem}</Text> : null}
        {s.duration_minutes ? <Text style={{ fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, color: colors.textTertiary, marginTop: 2 }}>{t('session_ui.minutes', { n: formatNumber(s.duration_minutes) })}</Text> : null}
      </View>

      <View style={{ flex: 1, padding: spacing.md, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{s.course_name ?? '—'}</Text>
          <View style={{ backgroundColor: p.chipBg, borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 9 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: p.chipText }}>{t(p.key)}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          {s.cycle_position ? (
            <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.full, paddingVertical: 1, paddingHorizontal: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.brand }}>{t('teacher.position_of', { n: formatNumber(s.cycle_position.n), of: formatNumber(s.cycle_position.of) })}</Text>
            </View>
          ) : null}
          {s.location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name="location" size={12} color={colors.textTertiary} outline />
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{s.location}</Text>
            </View>
          ) : null}
        </View>

        {phase !== 'cancelled' && total > 0 ? (
          <View style={{ gap: 4, marginTop: 2 }}>
            <AttendanceBar present={present} absent={absent} total={total} height={6} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>
              {t('session_ui.present_of', { n: formatNumber(present), of: formatNumber(total) })}
              {absent > 0 ? ` · ${t('session_ui.absent_n', { n: formatNumber(absent) })}` : ''}
            </Text>
          </View>
        ) : null}

        {/* The compact card's only way into the session (see Shell above). */}
        {compact ? (
          <TouchableOpacity onPress={() => onOpen(s)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('session_ui.open_details')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38, marginTop: 4, borderRadius: radius.md, borderWidth: 1.5, borderColor: phase === 'live' ? colors.success : colors.brand }}>
            <Icon name="attendance" size={16} color={phase === 'live' ? colors.successText : colors.brand} outline />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: phase === 'live' ? colors.successText : colors.brand }}>{t('session_ui.open_details')}</Text>
            <Icon name="back" size={14} color={phase === 'live' ? colors.successText : colors.brand} />
          </TouchableOpacity>
        ) : null}

        {actionable ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4 }}>
            {onScan ? (
              <TouchableOpacity onPress={() => onScan(s)} activeOpacity={0.85} accessibilityRole="button"
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, borderRadius: radius.md, backgroundColor: phase === 'live' ? colors.success : colors.brand }}>
                <Icon name="scan" size={17} color="#fff" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('sessions_tab.scan')}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => onOpen(s)} activeOpacity={0.85} accessibilityRole="button"
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, borderRadius: radius.md, borderWidth: 1.5, borderColor: phase === 'live' ? colors.success : colors.brand, backgroundColor: colors.surface }}>
              <Icon name="attendance" size={17} color={phase === 'live' ? colors.success : colors.brand} outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: phase === 'live' ? colors.success : colors.brand }}>{t('sessions_tab.sheet')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Shell>
  );
});
