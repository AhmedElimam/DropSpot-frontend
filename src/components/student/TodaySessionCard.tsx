import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { formatNumber, formatTime } from '@/utils/format';
import type { SessionInstance } from '@/types/session-instance';

export type SessionPhase = 'live' | 'soon' | 'later' | 'done' | 'cancelled';

/** Where a session stands against the clock: running, starting within the hour, later, over. */
export function sessionPhase(s: SessionInstance, now: number): { phase: SessionPhase; minutesToStart: number; progress: number } {
  const start = new Date(s.scheduled_at).getTime();
  const end = start + (s.duration_minutes || 60) * 60000;
  const minutesToStart = Math.ceil((start - now) / 60000);
  if (s.status === 'cancelled') return { phase: 'cancelled', minutesToStart, progress: 0 };
  if (s.status === 'completed' || now >= end) return { phase: 'done', minutesToStart, progress: 1 };
  if (s.status === 'live' || now >= start) return { phase: 'live', minutesToStart, progress: Math.min(1, Math.max(0, (now - start) / (end - start))) };
  return { phase: minutesToStart <= 60 ? 'soon' : 'later', minutesToStart, progress: 0 };
}

/**
 * One of today's sessions on the check-in tab (founder 2026-10-03: «today's sessions needs
 * some love»). The teacher's logo or character, the course, who and where, the time range,
 * and where the session stands right now: a live pill with an elapsed bar, «starts in N
 * minutes», later today, or the student's recorded outcome once it is over. A session the
 * student can check into from the phone is a radio; the others are read-only.
 */
export const TodaySessionCard = memo(function TodaySessionCard({ session, now, teacher, selected, checkable, inWindow, onSelect }: {
  session: SessionInstance;
  now: number;
  /** Resolved from the student's teachers list by name; null when unmatched. */
  teacher: { id: number; logo_url: string | null } | null;
  selected: boolean;
  checkable: boolean;
  inWindow: boolean;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation();
  const { phase, minutesToStart, progress } = sessionPhase(session, now);
  const start = new Date(session.scheduled_at);
  const end = new Date(start.getTime() + (session.duration_minutes || 60) * 60000);
  const outcome = session.attendance_status ?? null;

  const pill = outcome
    ? null
    : phase === 'live' ? { fg: colors.successText, bg: colors.successLight, label: t('attendance.phase_live'), dot: colors.success }
    : phase === 'soon' ? { fg: colors.brand, bg: colors.brandTint, label: t('attendance.phase_soon', { n: formatNumber(Math.max(1, minutesToStart)) }), dot: colors.brand }
    : phase === 'later' ? { fg: colors.textSecondary, bg: colors.surfaceSunken, label: t('attendance.phase_later'), dot: colors.textTertiary }
    : phase === 'cancelled' ? { fg: colors.dangerText, bg: colors.dangerLight, label: t('attendance.phase_cancelled'), dot: colors.danger }
    : { fg: colors.textTertiary, bg: colors.surfaceSunken, label: t('attendance.phase_done'), dot: colors.textTertiary };

  const rail = selected ? colors.brand
    : outcome === 'present' || outcome === 'late' ? colors.success
    : outcome === 'absent' ? colors.danger
    : outcome === 'excused' ? colors.info
    : phase === 'live' ? colors.success
    : phase === 'soon' ? colors.brand
    : colors.borderStrong;

  return (
    <TouchableOpacity
      onPress={() => checkable && onSelect(session.id)}
      activeOpacity={checkable ? 0.8 : 1}
      disabled={!checkable}
      accessibilityRole={checkable ? 'radio' : undefined}
      accessibilityState={checkable ? { selected } : undefined}
      style={{
        backgroundColor: selected ? colors.brandTint : colors.surface,
        borderRadius: radius.xl,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.brand : colors.border,
        borderStartWidth: 5,
        borderStartColor: rail,
        padding: spacing.md,
        opacity: phase === 'cancelled' ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ borderRadius: 14, overflow: 'hidden' }}>
          {teacher?.logo_url ? (
            <Image source={{ uri: teacher.logo_url }} style={{ width: 46, height: 46, backgroundColor: colors.surfaceSunken }} contentFit="cover" accessibilityLabel={session.teacher_name} />
          ) : teacher ? (
            <GeneratedAvatar seed={avatarSeed.user(teacher.id)} size={46} square label={session.teacher_name} />
          ) : (
            <View style={{ width: 46, height: 46, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sessions" size={22} color={colors.brand} />
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }} numberOfLines={1}>{session.course_name}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {[session.teacher_name, session.location].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {outcome ? (
          <StatusBadge status={outcome} size="sm" />
        ) : checkable ? (
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? colors.brand : colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
            {selected ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} /> : null}
          </View>
        ) : null}
      </View>

      {/* Time, where it stands, and how attendance is taken. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 }}>
          <Icon name="clock" size={13} color={colors.textSecondary} outline />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }}>{formatTime(start)} – {formatTime(end)}</Text>
        </View>
        {pill ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: pill.bg, borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: pill.dot }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: pill.fg }}>{pill.label}</Text>
          </View>
        ) : null}
        {session.status === 'scheduled' || phase === 'live' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name={session.phone_checkin_allowed ? 'phone' : 'card'} size={12} color={session.phone_checkin_allowed ? colors.successText : colors.textTertiary} outline={!session.phone_checkin_allowed} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: session.phone_checkin_allowed ? colors.successText : colors.textTertiary }}>
              {session.phone_checkin_allowed ? t('attendance.phone_allowed_badge') : t('attendance.card_only_badge')}
            </Text>
          </View>
        ) : null}
      </View>

      {phase === 'live' ? (
        <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.borderLight, overflow: 'hidden', marginTop: spacing.sm }}>
          <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: colors.success }} />
        </View>
      ) : null}

      {/* Only while it is running: before it starts the «later / starts in» pill already says it. */}
      {session.phone_checkin_allowed && phase === 'live' && !inWindow && !outcome ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 6 }}>{t('attendance.outside_window')}</Text>
      ) : null}
    </TouchableOpacity>
  );
});
