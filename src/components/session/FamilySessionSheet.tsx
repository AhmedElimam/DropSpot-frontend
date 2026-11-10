import type { ReactNode } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { HomeworkRatingBadge } from '@/components/homework/HomeworkChips';
import { statusTone } from '@/components/attendance/AttendanceRecordRow';
import { getFamilySessionDetail, type FamilySessionDetail } from '@/api/familySession';
import { dayLabel, formatDate, formatNumber, formatTime } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { tracksAttendance } from '@/utils/privateLesson';

export interface FamilySessionTarget {
  studentId: number;
  sessionId: number;
  /** The student reads «ملاحظة لك»; a parent reads «ملاحظة عن {name}». */
  who: 'student' | 'parent';
}

/**
 * Everything about one session for one child (founder 2026-11-10: «a session details modal on
 * the student and parent side — notes, homework, sheet marks, everything»). Opened from any
 * attendance row on the teacher page, the attendance page or the parent's child page.
 */
export function FamilySessionSheet({ target, onClose }: { target: FamilySessionTarget | null; onClose: () => void }) {
  const { height } = useWindowDimensions();
  return (
    <SheetModal visible={!!target} onClose={onClose} style={{ backgroundColor: colors.background }}>
      <View style={{ maxHeight: height * 0.82 }}>
        {target ? <Body target={target} /> : null}
      </View>
    </SheetModal>
  );
}

function Body({ target }: { target: FamilySessionTarget }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['family-session', target.studentId, target.sessionId],
    queryFn: () => getFamilySessionDetail(target.studentId, target.sessionId),
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return <View style={{ paddingVertical: spacing.xxxl, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!q.data) {
    return (
      <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.md }}>
        <Icon name="warning" size={26} color={colors.textTertiary} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
          {q.error ? getFriendlyErrorMessage(q.error) : t('family_session.load_failed')}
        </Text>
        <TouchableOpacity onPress={() => q.refetch()} accessibilityRole="button" activeOpacity={0.85}
          style={{ minHeight: 42, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.brand }}>{t('family_session.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return <Content d={q.data} who={target.who} />;
}

function Content({ d, who }: { d: FamilySessionDetail; who: 'student' | 'parent' }) {
  const { t } = useTranslation();
  const when = d.scheduled_at ? new Date(d.scheduled_at) : null;
  const ok = when && !isNaN(when.getTime());
  const tracked = tracksAttendance(d);
  const a = d.attendance;
  const tone = statusTone(tracked ? a?.status ?? null : null);
  const teacher = d.teacher_name ? t(d.teacher_gender === 'female' ? 'family_session.teacher_f' : 'family_session.teacher', { name: d.teacher_name }) : null;
  const nothingWritten = !d.summary && !d.note && !d.homework_given && !d.homework_checked && !d.mark;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.md }}>
      {/* The session itself. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={d.type === 'quiz_exam' ? 'reports' : 'sessions'} size={22} color={tone.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={2}>
            {d.type === 'quiz_exam' ? `${t('student_teacher.exam_label')} · ` : ''}{d.course_name ?? '—'}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            {[ok ? formatDate(when, { weekday: 'long', day: 'numeric', month: 'long' }) : null, ok ? formatTime(when) : null].filter(Boolean).join(' · ')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginTop: 1 }} numberOfLines={2}>
            {[teacher, t('student_teacher.minutes', { n: formatNumber(d.duration_minutes) }), d.location].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {d.session_status === 'cancelled' ? (
        <Block icon="warning" color={colors.danger} title={t('family_session.cancelled')} />
      ) : null}

      {/* Attendance. */}
      {tracked ? (
        <Block icon="attendance" color={colors.success} title={t('family_session.attendance')}
          right={a ? <StatusBadge status={a.status} size="sm" /> : null}>
          {!a ? (
            <Muted>{ok && when.getTime() > Date.now() ? t('family_session.upcoming') : t('family_session.no_record')}</Muted>
          ) : (
            <View style={{ gap: 6 }}>
              {(a.status === 'present' || a.status === 'late') && a.checked_in_at ? (
                <Line>{[t('family_session.checked_in_at', { time: formatTime(a.checked_in_at) }), methodLabel(a.check_in_method, t)].filter(Boolean).join(' · ')}</Line>
              ) : null}
              {a.via_swap ? <Line>{t('family_session.via_swap')}</Line> : null}
              {a.covered_in ? (
                <Line>{t('family_session.covered_in', {
                  course: a.covered_in.course_name ?? '',
                  day: a.covered_in.scheduled_at ? dayLabel(a.covered_in.scheduled_at) : '',
                })}</Line>
              ) : null}
              {a.excuse?.reason ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary }}>{t('family_session.excuse', { reason: a.excuse.reason })}</Text>
                  {a.excuse.status ? <StatusBadge status={a.excuse.status} size="sm" /> : null}
                </View>
              ) : null}
            </View>
          )}
        </Block>
      ) : null}

      {/* The sheet mark. */}
      {d.mark ? (
        <Block icon="grades" color={colors.brand} title={t(d.mark.is_exam ? 'family_session.exam_mark' : 'family_session.mark')}
          right={
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.brand }}>
              {formatNumber(d.mark.score)}{d.mark.max != null ? ` / ${formatNumber(d.mark.max)}` : ''}
            </Text>
          }>
          {d.mark.percentage != null ? (
            <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(100, d.mark.percentage)}%`, height: '100%', borderRadius: 4, backgroundColor: colors.brand }} />
            </View>
          ) : null}
        </Block>
      ) : null}

      {/* What the teacher wrote to the whole session. */}
      {d.summary ? (
        <Block icon="note" color={colors.info} title={t('session_notes.summary_label')}>
          <Body2>{d.summary}</Body2>
        </Block>
      ) : null}

      {/* The note about this child. */}
      {d.note ? (
        <Block icon="child" color={colors.accent} title={who === 'student' ? t('session_notes.note_label_me') : t('session_notes.note_label_child', { name: d.student_name ?? '' })}>
          <Body2>{d.note}</Body2>
        </Block>
      ) : null}

      {/* Homework given at this session, and how it was graded at the next. */}
      {d.homework_given ? (
        <Block icon="list" color={colors.brand} title={t('family_session.homework_given')} right={<HomeworkRatingBadge rating={d.homework_given.rating} />}>
          <Body2>{d.homework_given.body}</Body2>
        </Block>
      ) : null}

      {/* Homework of the previous session, graded at this one. */}
      {d.homework_checked ? (
        <Block icon="success" color={colors.success}
          title={t('family_session.homework_checked', { day: d.homework_checked.assigned_on ? dayLabel(d.homework_checked.assigned_on) : '' })}
          right={<HomeworkRatingBadge rating={d.homework_checked.rating} />}>
          <Body2>{d.homework_checked.body}</Body2>
        </Block>
      ) : null}

      {nothingWritten && d.session_status !== 'cancelled' ? (
        <Muted>{t('family_session.nothing_written')}</Muted>
      ) : null}
    </ScrollView>
  );
}

/** How the attendance was taken, in the words the record badges use; nothing for an unknown method. */
function methodLabel(method: string | null, t: (k: string) => string): string | null {
  if (method === 'card_scan') return t('status.method_card_scan');
  if (method === 'manual') return t('status.method_manual');
  if (method === 'phone_permitted' || method === 'phone') return t('status.method_phone');
  return null;
}

function Block({ icon, color, title, right, children }: { icon: IconName; color: string; title: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: `${color}1A`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={color} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={2}>{title}</Text>
        {right ?? null}
      </View>
      {children ?? null}
    </View>
  );
}

function Body2({ children }: { children: ReactNode }) {
  return <Text selectable style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textPrimary }}>{children}</Text>;
}

function Line({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary }}>{children}</Text>;
}

function Muted({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.sm }}>{children}</Text>;
}
