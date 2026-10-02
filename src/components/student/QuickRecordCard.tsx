import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useSessionControls } from '@/hooks/useTeacherSessionHistory';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { sessionPhase } from '@/utils/sessionPhase';
import { dayLabel, formatNumber } from '@/utils/format';
import type { QuickSession } from '@/api/students';
import type { SessionDetail } from '@/api/teacherSessions';

type Status = 'present' | 'late' | 'absent' | 'excused';
type Shown = QuickSession['attendance'] & { pending?: boolean };

const MARKS: { key: Status; icon: IconName; color: string; label: string }[] = [
  { key: 'present', icon: 'present', color: colors.success, label: 'attendance.present' },
  { key: 'late', icon: 'late', color: colors.warning, label: 'attendance.late' },
  { key: 'absent', icon: 'absent', color: colors.danger, label: 'attendance.absent' },
  { key: 'excused', icon: 'excused', color: colors.info, label: 'attendance.excused' },
];
const DOT: Record<string, string> = {
  present: colors.success, late: colors.warning, absent: colors.danger, excused: colors.info, not_recorded: colors.borderStrong,
};

/**
 * «تسجيل سريع» on the student profile (founder 2026-10-02: "a fast shortcut for recording
 * absence, check-in and exam or sheets"). Pick one of the student's recent sessions —
 * the live one is picked for you — then one tap for حاضر / متأخر / غائب / معذور and, once
 * they attended, the sheet or exam mark. Writes go through the SAME session controls as
 * the attendance sheet, so a mark made with no signal is queued and replayed like any
 * other offline mark, and the server's verdicts (overdue bill, not enrolled…) are shown.
 */
export function QuickRecordCard({
  studentId, sessions, canMark, onChanged,
}: { studentId: number; sessions: QuickSession[]; canMark: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const now = useMinuteClock();

  const initial = useMemo(() => {
    const live = sessions.find((s) => sessionPhase(s, now) === 'live');
    // Otherwise the most recent that has started (the server sends newest first).
    return (live ?? sessions.find((s) => !s.scheduled_at || new Date(s.scheduled_at).getTime() <= now) ?? sessions[0])?.id ?? null;
  }, [sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedId, setSelectedId] = useState<string | null>(initial);
  useEffect(() => { if (!sessions.some((s) => s.id === selectedId)) setSelectedId(initial); }, [sessions, selectedId, initial]);
  const session = sessions.find((s) => s.id === selectedId) ?? null;

  // What this phone did since the profile loaded (incl. marks queued offline).
  const [local, setLocal] = useState<Record<string, Partial<Shown>>>({});
  // A fresh profile from the server is the truth again — keep only what is still queued.
  useEffect(() => {
    setLocal((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v.pending)));
  }, [sessions]);
  const shown: Shown | null = session ? { ...session.attendance, ...local[session.id] } : null;

  const controls = useSessionControls(selectedId ?? '0');
  const [markDraft, setMarkDraft] = useState('');
  useEffect(() => { setMarkDraft(shown?.mark != null ? String(shown.mark) : ''); }, [selectedId, shown?.mark]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session || !shown) return null;

  const phase = sessionPhase(session, now);
  const attended = shown.status === 'present' || shown.status === 'late';
  const showMark = session.is_exam || session.sheet_expected || shown.mark != null;

  const pick = (fresh: SessionDetail | undefined) =>
    fresh?.attendees.find((a) => a.student_id === studentId) ?? fresh?.swap_ins?.find((a) => a.student_id === studentId);

  const mark = (status: Status) => {
    if (!selectedId || status === shown.status) return;
    const sid = selectedId;
    controls.mark.mutate({ studentId, status }, {
      onSuccess: (fresh) => {
        const me = pick(fresh);
        setLocal((m) => ({ ...m, [sid]: { ...m[sid], status: (me?.status as Shown['status']) ?? status, pending: !!me?.pending_sync, mark: me?.mark ?? m[sid]?.mark } }));
        onChanged();
      },
      onError: (e: any) => {
        if (e?.message === 'OFFLINE_QUEUED') {
          setLocal((m) => ({ ...m, [sid]: { ...m[sid], status, pending: true } }));
          return;
        }
        Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.error'));
      },
    });
  };

  const saveMark = () => {
    if (!selectedId) return;
    const sid = selectedId;
    const raw = markDraft.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace('٫', '.');
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0)) return Alert.alert(t('common.error'), t('quick_record.bad_mark'));
    if (value !== null && session.sheet_max_mark != null && value > session.sheet_max_mark) {
      return Alert.alert(t('common.error'), t('quick_record.over_max', { max: formatNumber(session.sheet_max_mark) }));
    }
    controls.grade.mutate({ studentId, mark: value }, {
      onSuccess: (fresh) => {
        const me = pick(fresh);
        setLocal((m) => ({ ...m, [sid]: { ...m[sid], mark: me?.mark ?? value, sheet_marked: me?.sheet_marked ?? value !== null } }));
        onChanged();
      },
      onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.error')),
    });
  };

  const busy = controls.mark.isPending;
  const markChanged = markDraft.trim() !== (shown.mark != null ? String(shown.mark) : '');

  return (
    <View style={{ marginTop: spacing.md, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <LinearGradient colors={phase === 'live' ? gradients.success : gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="attendance" size={18} color="#fff" />
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('quick_record.title')}</Text>
          <TouchableOpacity onPress={() => router.push(`/(teacher)/sessions/${session.id}` as Href)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{t('sessions_tab.sheet')}</Text>
            <Icon name="back" size={14} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        {/* Which session — chips, newest first; the dot is this student's record in it. */}
        {sessions.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md }}>
            {sessions.map((x) => {
              const on = x.id === selectedId;
              const st = local[x.id]?.status ?? x.attendance.status;
              const live = sessionPhase(x, now) === 'live';
              return (
                <TouchableOpacity key={x.id} onPress={() => setSelectedId(x.id)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.14)' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DOT[st] ?? DOT.not_recorded, borderWidth: on ? 0 : 1, borderColor: 'rgba(255,255,255,0.5)' }} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.textPrimary : '#fff' }}>
                    {live ? t('teacher.live_now') : `${dayLabel(x.scheduled_at)}${x.time ? ` · ${x.time}` : ''}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff', marginTop: spacing.md }} numberOfLines={1}>{session.course_name ?? '—'}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 2 }}>
          {dayLabel(session.scheduled_at)}{session.time ? ` · ${session.time}` : ''}
          {session.is_exam ? ` · ${t('teacher.type_quiz_exam')}` : ''}
          {shown.checked_in_at && attended ? ` · ${t('quick_record.checked_in_at', { time: shown.checked_in_at })}` : ''}
        </Text>
      </LinearGradient>

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {canMark ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {MARKS.map((m) => {
              const on = shown.status === m.key;
              return (
                <TouchableOpacity key={m.key} onPress={() => mark(m.key)} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: on ? m.color : m.color + '14', borderWidth: on ? 0 : 1, borderColor: m.color + '55', opacity: busy && !on ? 0.6 : 1 }}>
                  <Icon name={m.icon} size={24} color={on ? '#fff' : m.color} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? '#fff' : m.color }}>{t(m.label)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>
            {t('quick_record.status_now', { status: t(shown.status === 'not_recorded' ? 'teacher.not_recorded' : `attendance.${shown.status}`) })}
          </Text>
        )}
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
        {shown.pending ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="offline" size={14} color={colors.warningText} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warningText }}>{t('teacher.mark_pending_sync')}</Text>
          </View>
        ) : null}

        {showMark ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm }}>
              {t(session.is_exam ? 'quick_record.exam_mark' : 'quick_record.sheet_mark')}
            </Text>
            {attended && !shown.pending ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
                  <TextInput value={markDraft} onChangeText={setMarkDraft} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, height: 48, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'center' }} />
                  {session.sheet_max_mark != null ? (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textTertiary }}>{`/ ${formatNumber(session.sheet_max_mark)}`}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={saveMark} disabled={!markChanged || controls.grade.isPending} activeOpacity={0.85}
                  style={{ height: 48, paddingHorizontal: spacing.xl, borderRadius: radius.lg, backgroundColor: markChanged ? colors.brand : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                  {controls.grade.isPending ? <ActivityIndicator color="#fff" /> : (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: markChanged ? '#fff' : colors.textTertiary }}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
                {shown.pending ? t('quick_record.mark_after_sync') : t('quick_record.mark_needs_attendance')}
              </Text>
            )}
            {shown.sheet_marked && shown.mark != null ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.success, marginTop: 6 }}>
                {t('quick_record.mark_saved', { mark: formatNumber(shown.mark) })}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
