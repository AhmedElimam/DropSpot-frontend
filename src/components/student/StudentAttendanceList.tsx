import { SheetModal } from '@/components/ui/SheetModal';
import { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useSessionControls } from '@/hooks/useTeacherSessionHistory';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { sessionPhase } from '@/utils/sessionPhase';
import { dayLabel, formatNumber } from '@/utils/format';
import type { QuickSession, StudentAttendanceRow } from '@/api/students';
import type { SessionDetail } from '@/api/teacherSessions';
import { SessionKindToggle, toLatinNumber, type SessionKind } from '@/components/session/SessionMarks';

type Status = 'present' | 'late' | 'absent' | 'excused';
type Record_ = QuickSession['attendance'] & { pending?: boolean };

// Same colours and words as the session sheet's rows.
const STATUS_COLOR: Record<string, string> = {
  present: colors.success, late: colors.warning, absent: colors.danger, excused: colors.info, not_recorded: colors.borderStrong,
};
const STATUS_KEY: Record<string, string> = {
  present: 'attendance.present', late: 'attendance.late', absent: 'attendance.absent', excused: 'attendance.excused', not_recorded: 'teacher.not_recorded',
};
const MARK_OPTIONS: { status: Status; color: string; icon: IconName }[] = [
  { status: 'present', color: colors.success, icon: 'present' },
  { status: 'late', color: colors.warning, icon: 'late' },
  { status: 'absent', color: colors.danger, icon: 'absent' },
  { status: 'excused', color: colors.info, icon: 'excused' },
];
const DAY_FMT = new Intl.DateTimeFormat('ar-EG', { weekday: 'short' });

const PREVIEW = 12;

/** The date tile at the row's start — where the session sheet has the avatar. */
function DateTile({ iso, live }: { iso: string | null; live: boolean }) {
  const d = iso ? new Date(iso) : null;
  return (
    <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: live ? colors.success : colors.brandTint }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 19, color: live ? '#fff' : colors.brand }}>{d ? formatNumber(d.getDate()) : '—'}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 9, lineHeight: 12, color: live ? 'rgba(255,255,255,0.85)' : colors.brand }}>{d ? DAY_FMT.format(d) : ''}</Text>
    </View>
  );
}

type RowProps = {
  session: QuickSession;
  rec: Record_;
  live: boolean;
  canMark: boolean;
  studentId: number;
  onOpen: (s: QuickSession) => void;
  onRecorded: (sessionId: string, patch: Partial<Record_>) => void;
};

/** A recordable row — the session sheet's row turned around: one session, this student. */
const RecordableRow = memo(function RecordableRow({ session, rec, live, canMark, studentId, onOpen, onRecorded }: RowProps) {
  const { t } = useTranslation();
  const controls = useSessionControls(session.id);
  const color = STATUS_COLOR[rec.status] ?? STATUS_COLOR.not_recorded;
  const recorded = rec.status !== 'not_recorded';

  const mark = (status: Status) => markStudent(controls, studentId, session.id, status, rec.status, onRecorded, t);

  return (
    <TouchableOpacity onPress={() => onOpen(session)} activeOpacity={0.85} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: live ? colors.success : colors.border, borderStartWidth: 4, borderStartColor: color, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm, minHeight: 64 }}>
      <DateTile iso={session.scheduled_at} live={live} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{session.course_name ?? '—'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          {live ? <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.success }}>{t('teacher.live_now')}</Text> : null}
          {recorded ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color }}>{t(STATUS_KEY[rec.status])}{rec.checked_in_at && (rec.status === 'present' || rec.status === 'late') ? ` · ${rec.checked_in_at}` : ''}</Text>
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{session.time ?? t('teacher.not_recorded')}</Text>
          )}
          {session.is_exam ? <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.accent }}>{`· ${t('teacher.type_quiz_exam')}`}</Text> : null}
          {rec.mark != null ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.brand }}>
              {`· ${t('teacher.mark_short', { mark: session.sheet_max_mark != null ? `${formatNumber(rec.mark)}/${formatNumber(session.sheet_max_mark)}` : formatNumber(rec.mark) })}`}
            </Text>
          ) : null}
          {rec.pending ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.warningText }}>{`· ${t('teacher.mark_pending_sync')}`}</Text> : null}
        </View>
      </View>
      {canMark ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['present', 'absent'] as const).map((st) => {
            const on = rec.status === st || (st === 'present' && rec.status === 'late');
            const c = st === 'present' ? colors.success : colors.danger;
            return (
              <TouchableOpacity key={st} onPress={() => mark(st)} disabled={controls.mark.isPending} hitSlop={4} accessibilityLabel={t(STATUS_KEY[st])}
                style={{ width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? c : c + '14', borderWidth: on ? 0 : 1, borderColor: c + '55' }}>
                {controls.mark.isPending && !on ? <ActivityIndicator size="small" color={c} /> : <Icon name={st === 'present' ? 'present' : 'absent'} size={22} color={on ? '#fff' : c} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

/** A record with no recordable session behind it (e.g. the session was cancelled): read-only, opens its sheet. */
const HistoryRow = memo(function HistoryRow({ r }: { r: StudentAttendanceRow }) {
  const { t } = useTranslation();
  const color = STATUS_COLOR[r.status] ?? STATUS_COLOR.not_recorded;
  const open = r.session_id ? () => router.push(`/(teacher)/sessions/${r.session_id}` as Href) : undefined;
  return (
    <TouchableOpacity onPress={open} disabled={!open} activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: color, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm, minHeight: 60 }}>
      <DateTile iso={r.date} live={false} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{r.course_name ?? '—'}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color, marginTop: 2 }}>{t(STATUS_KEY[r.status] ?? 'teacher.not_recorded')}</Text>
      </View>
      {open ? <Icon name="back" size={16} color={colors.textTertiary} /> : null}
    </TouchableOpacity>
  );
});

function markStudent(
  controls: ReturnType<typeof useSessionControls>, studentId: number, sessionId: string, status: Status, current: string,
  onRecorded: (sessionId: string, patch: Partial<Record_>) => void, t: (k: string) => string,
) {
  if (status === current) return;
  controls.mark.mutate({ studentId, status }, {
    onSuccess: (fresh: SessionDetail) => {
      const me = fresh?.attendees.find((a) => a.student_id === studentId) ?? fresh?.swap_ins?.find((a) => a.student_id === studentId);
      onRecorded(sessionId, { status: (me?.status as Record_['status']) ?? status, pending: !!me?.pending_sync, checked_in_at: me?.checked_in_at ?? null });
    },
    onError: (e: any) => {
      // Queued on this phone with no cached sheet to patch — still a mark, still delivered.
      if (e?.message === 'OFFLINE_QUEUED') { onRecorded(sessionId, { status, pending: true }); return; }
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.error'));
    },
  });
}

/** The session sheet's student modal, for one session of this student: 4 marks + the sheet / exam mark. */
function RecordSheet({ session, rec, studentId, canMark, isAssistant, onRecorded, onClose }: {
  session: QuickSession; rec: Record_; studentId: number; canMark: boolean; isAssistant: boolean;
  onRecorded: (sessionId: string, patch: Partial<Record_>) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const controls = useSessionControls(session.id);
  const [draft, setDraft] = useState(rec.mark != null ? String(rec.mark) : '');
  useEffect(() => { setDraft(rec.mark != null ? String(rec.mark) : ''); }, [rec.mark]);
  const attended = rec.status === 'present' || rec.status === 'late';
  const changed = draft.trim() !== (rec.mark != null ? String(rec.mark) : '');
  // Sheet or big exam — the session's type, so it applies to every student in it.
  const [kind, setKind] = useState<SessionKind>(session.is_exam ? 'quiz_exam' : 'normal_sheet');
  useEffect(() => { setKind(session.is_exam ? 'quiz_exam' : 'normal_sheet'); }, [session.is_exam]);
  const changeKind = (k: SessionKind) => controls.setType.mutate(k, {
    onSuccess: () => { setKind(k); onRecorded(session.id, {}); },
    onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.session_type_failed')),
  });

  const save = () => {
    const raw = toLatinNumber(draft);
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0)) { Alert.alert(t('common.error'), t('quick_record.bad_mark')); return; }
    if (value !== null && session.sheet_max_mark != null && value > session.sheet_max_mark) {
      Alert.alert(t('common.error'), t('quick_record.over_max', { max: formatNumber(session.sheet_max_mark) })); return;
    }
    controls.grade.mutate({ studentId, mark: value }, {
      onSuccess: (fresh) => {
        const me = fresh?.attendees.find((a) => a.student_id === studentId) ?? fresh?.swap_ins?.find((a) => a.student_id === studentId);
        onRecorded(session.id, { mark: me?.mark ?? value, sheet_marked: me?.sheet_marked ?? value !== null });
      },
      onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.error')),
    });
  };

  return (
    <SheetModal visible onClose={onClose} avoidKeyboard style={{ backgroundColor: colors.background, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }} numberOfLines={1}>{session.course_name ?? '—'}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
                {dayLabel(session.scheduled_at)}{session.time ? ` · ${session.time}` : ''}{kind === 'quiz_exam' ? ` · ${t('teacher.type_quiz_exam')}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { onClose(); router.push(`/(teacher)/sessions/${session.id}` as Href); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('sessions_tab.sheet')}</Text>
              <Icon name="back" size={14} color={colors.brand} />
            </TouchableOpacity>
          </View>

          {canMark ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {MARK_OPTIONS.map((m) => {
                const on = rec.status === m.status;
                return (
                  <TouchableOpacity key={m.status} onPress={() => markStudent(controls, studentId, session.id, m.status, rec.status, onRecorded, t)} disabled={controls.mark.isPending} activeOpacity={0.85} accessibilityState={{ selected: on }}
                    style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: on ? m.color : m.color + '14', borderWidth: on ? 0 : 1, borderColor: m.color + '55' }}>
                    <Icon name={m.icon} size={24} color={on ? '#fff' : m.color} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? '#fff' : m.color }}>{t(STATUS_KEY[m.status])}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: STATUS_COLOR[rec.status] ?? colors.textSecondary }}>{t(STATUS_KEY[rec.status] ?? 'teacher.not_recorded')}</Text>
          )}
          {rec.pending ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warningText }}>{t('teacher.mark_pending_sync')}</Text> : null}
          {isAssistant && canMark ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="eye" size={14} color={colors.textTertiary} />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('quick_record.assistant_note')}</Text>
            </View>
          ) : null}

          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
            <View style={{ marginBottom: spacing.md }}>
              <SessionKindToggle value={kind} busy={controls.setType.isPending} onChange={changeKind} compact />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm }}>
              {t(kind === 'quiz_exam' ? 'quick_record.exam_mark' : 'quick_record.sheet_mark')}
            </Text>
            {attended && !rec.pending ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
                  <TextInput value={draft} onChangeText={setDraft} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, height: 48, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'center' }} />
                  {session.sheet_max_mark != null ? <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textTertiary }}>{`/ ${formatNumber(session.sheet_max_mark)}`}</Text> : null}
                </View>
                <TouchableOpacity onPress={save} disabled={!changed || controls.grade.isPending} activeOpacity={0.85}
                  style={{ height: 48, paddingHorizontal: spacing.xl, borderRadius: radius.lg, backgroundColor: changed ? colors.brand : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                  {controls.grade.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: changed ? '#fff' : colors.textTertiary }}>{t('common.save')}</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
                {rec.pending ? t('quick_record.mark_after_sync') : t('quick_record.mark_needs_attendance')}
              </Text>
            )}
          </View>
    </SheetModal>
  );
}

/**
 * «سجل الحضور» on the student profile, in the session sheet's style (founder 2026-10-02:
 * "remove this huge card … make it at the bottom where تسجيلات الحضور is, like session
 * details"). EVERY session row is recordable in place, to any status — ✓ / ✗ on the row,
 * a tap for متأخر / معذور and the sheet or exam mark: the last two weeks plus every older
 * session the student has a record in. An assistant's change of a recorded status (or of
 * an ended session) goes to the teacher's review bucket server-side. Records the server
 * did not send as sessions (a cancelled session) stay read-only and open their session. Writes go through the session
 * sheet's own controls, so offline marks queue and replay the same way.
 */
export function StudentAttendanceList({ studentId, sessions, history, canMark, isAssistant = false, onChanged }: {
  studentId: number; sessions: QuickSession[]; history: StudentAttendanceRow[]; canMark: boolean;
  /** An assistant is told that changing a recorded status goes to the teacher for review. */
  isAssistant?: boolean; onChanged: () => void;
}) {
  const { t } = useTranslation();
  const now = useMinuteClock();
  const [local, setLocal] = useState<Record<string, Partial<Record_>>>({});
  // A fresh profile is the truth again — keep only what is still queued on this phone.
  useEffect(() => { setLocal((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v.pending))); }, [sessions]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const recOf = (s: QuickSession): Record_ => ({ ...s.attendance, ...local[s.id] });
  const onRecorded = useMemo(() => (sessionId: string, patch: Partial<Record_>) => {
    setLocal((m) => ({ ...m, [sessionId]: { ...m[sessionId], ...patch } }));
    if (!patch.pending) onChanged();
  }, [onChanged]);
  const onOpen = useMemo(() => (s: QuickSession) => setOpenId(s.id), []);

  const recentIds = useMemo(() => new Set(sessions.map((s) => s.id)), [sessions]);
  const older = useMemo(() => history.filter((r) => !r.session_id || !recentIds.has(r.session_id)), [history, recentIds]);
  const sessionsShown = showAll ? sessions : sessions.slice(0, PREVIEW);
  const olderShown = showAll ? older : older.slice(0, Math.max(0, PREVIEW - sessionsShown.length));
  const hidden = sessions.length + older.length - sessionsShown.length - olderShown.length;
  const open = sessions.find((s) => s.id === openId) ?? null;

  if (sessions.length === 0 && history.length === 0) {
    return <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{t('teacher.no_attendance')}</Text>;
  }

  return (
    <View>
      {sessionsShown.map((s) => (
        <RecordableRow key={s.id} session={s} rec={recOf(s)} live={sessionPhase(s, now) === 'live'} canMark={canMark}
          studentId={studentId} onOpen={onOpen} onRecorded={onRecorded} />
      ))}
      {olderShown.map((r) => <HistoryRow key={r.id} r={r} />)}
      {!showAll && hidden > 0 ? (
        <TouchableOpacity onPress={() => setShowAll(true)} style={{ paddingVertical: spacing.md, alignItems: 'center' }} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('quick_record.show_all', { n: formatNumber(sessions.length + older.length) })}</Text>
        </TouchableOpacity>
      ) : null}
      {open ? (
        <RecordSheet session={open} rec={recOf(open)} studentId={studentId} canMark={canMark} isAssistant={isAssistant} onRecorded={onRecorded} onClose={() => setOpenId(null)} />
      ) : null}
    </View>
  );
}
