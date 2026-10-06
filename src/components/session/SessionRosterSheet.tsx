import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Switch, Alert, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar } from '@/components/layout/Avatar';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { useSessionDetail, useSessionControls } from '@/hooks/useTeacherSessionHistory';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { formatNumber, foldForSearch } from '@/utils/format';
import type { SessionAttendee } from '@/api/teacherSessions';

type Status = 'present' | 'late' | 'absent' | 'excused';

const STATUS_COLOR = (): Record<string, string> => ({
  present: colors.success, late: colors.warning, absent: colors.danger, excused: colors.info, not_recorded: colors.borderStrong,
});
const STATUS_KEY: Record<string, string> = {
  present: 'attendance.present', late: 'attendance.late', absent: 'attendance.absent', excused: 'attendance.excused', not_recorded: 'teacher.not_recorded',
};
const MARKS: { status: Status; icon: IconName }[] = [
  { status: 'present', icon: 'present' },
  { status: 'late', icon: 'late' },
  { status: 'absent', icon: 'absent' },
  { status: 'excused', icon: 'excused' },
];
// Who still needs a decision first, then the late, absent, excused, and the present last.
const ORDER: Record<string, number> = { not_recorded: 0, late: 1, absent: 2, excused: 3, present: 4 };

/**
 * One session's «كشف الحضور» from the teacher's home, in a sheet (founder 2026-10-04: swipe
 * a session card from left to right → the students; «it's fast access — what's the use if
 * you can't do anything there»). Each row marks attendance in one tap; tapping the name
 * opens that student's sheet grade, the «تم تسليم الشريحة» switch and the note to the
 * parent. Same server calls as the full sheet, so marks also queue offline.
 *
 * The order is fixed when the sheet opens (not-yet-recorded first): marking a student
 * must not make the row jump away under the finger.
 */
export function SessionRosterSheet({ sessionId, onClose, onOpenFull }: {
  sessionId: string | null;
  onClose: () => void;
  onOpenFull: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const { can } = useActiveAbilities();
  const canMark = can(ABILITY.MARK_MANUAL);
  const q = useSessionDetail(sessionId ?? undefined);
  const controls = useSessionControls(sessionId ?? '');
  const s = sessionId ? q.data : undefined;
  const editable = !!s && !s.is_cancelled;

  const all: SessionAttendee[] = [...(s?.attendees ?? []), ...(s?.swap_ins ?? [])];
  const order = useRef<{ id: string | null; ids: number[] }>({ id: null, ids: [] });
  if (s && sessionId && order.current.id !== sessionId) {
    order.current = {
      id: sessionId,
      ids: [...all].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || (a.name ?? '').localeCompare(b.name ?? '', 'ar')).map((a) => a.student_id),
    };
  }
  if (!sessionId && order.current.id !== null) order.current = { id: null, ids: [] };
  const rank = (id: number) => { const i = order.current.ids.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
  const attendees = [...all].sort((a, b) => rank(a.student_id) - rank(b.student_id));
  const present = attendees.filter((a) => a.status === 'present' || a.status === 'late').length;

  // Find a student in a long roster (founder 2026-10-06): by name — «احمد» finds «أحمد» — or
  // by code. Filtering never reorders: the rows keep the order the sheet opened with.
  const [search, setSearch] = useState('');
  useEffect(() => { setSearch(''); }, [sessionId]);
  const needle = foldForSearch(search);
  const shown = needle
    ? attendees.filter((a) => foldForSearch(a.name).includes(needle) || foldForSearch(a.student_code).includes(needle))
    : attendees;

  // One student open at a time, with their drafts.
  const [openId, setOpenId] = useState<number | null>(null);
  const [gradeDraft, setGradeDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  useEffect(() => { if (!sessionId) setOpenId(null); }, [sessionId]);
  const toggleOpen = (a: SessionAttendee) => {
    if (openId === a.student_id) { setOpenId(null); return; }
    setOpenId(a.student_id);
    setGradeDraft(a.mark != null ? String(a.mark) : '');
    setNoteDraft(a.note ?? '');
  };

  const fail = (e: any, fallback: string) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t(fallback));
  const mark = (studentId: number, status: Status) => controls.mark.mutate({ studentId, status }, { onError: (e) => fail(e, 'common.error') });

  return (
    <SheetModal visible={!!sessionId} onClose={onClose} avoidKeyboard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="attendance" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={1}>{s?.course_name ?? t('home.roster_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {[s?.time, s ? t('home.roster_count', { present: formatNumber(present), total: formatNumber(attendees.length) }) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {controls.mark.isPending ? <ActivityIndicator color={colors.primary} /> : null}
      </View>

      {q.isLoading || (!s && !!sessionId && !q.isError) ? (
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
      ) : attendees.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl }}>{t('home.roster_empty')}</Text>
      ) : (
        <>
        {attendees.length > 3 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
            <Icon name="search" size={17} color={colors.textTertiary} />
            <TextInput value={search} onChangeText={setSearch} placeholder="ابحث بالاسم أو الكود" placeholderTextColor={colors.textTertiary}
              returnKeyType="search" autoCorrect={false} clearButtonMode="never"
              style={{ flex: 1, height: 44, marginStart: spacing.sm, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right', paddingVertical: 0 }} />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="مسح البحث">
                <Icon name="close" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        {shown.length === 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg }}>{`لا يوجد طالب باسم «${search.trim()}» في هذه الحصة`}</Text>
        ) : null}
        <ScrollView style={{ maxHeight: height * 0.6 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {shown.map((a) => {
            const color = STATUS_COLOR()[a.status] ?? STATUS_COLOR().not_recorded;
            const open = openId === a.student_id;
            return (
              <View key={a.student_id} style={{ paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                <TouchableOpacity onPress={() => toggleOpen(a)} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ expanded: open }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Avatar name={a.name ?? '—'} seed={avatarSeed.student(a.student_id, a.name ?? '—')} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{a.name ?? '—'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>
                        {t(STATUS_KEY[a.status] ?? 'teacher.not_recorded')}
                        {a.mark != null ? ` · ${formatNumber(a.mark)}${s?.sheet_max_mark != null ? `/${formatNumber(s.sheet_max_mark)}` : ''}` : ''}
                        {a.pending_sync ? ` · ${t('teacher.mark_pending_sync')}` : ''}
                      </Text>
                    </View>
                  </View>
                  <Icon name={open ? 'up' : 'down'} size={16} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* One tap per student: the four marks, the current one filled. */}
                {canMark && editable ? (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.sm }}>
                    {MARKS.map((m) => {
                      const c = STATUS_COLOR()[m.status];
                      const on = a.status === m.status;
                      return (
                        <TouchableOpacity key={m.status} onPress={() => { if (!on) mark(a.student_id, m.status); }} activeOpacity={0.8}
                          accessibilityRole="button" accessibilityLabel={t(STATUS_KEY[m.status])} accessibilityState={{ selected: on }}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 36, borderRadius: radius.md, backgroundColor: on ? c : 'transparent', borderWidth: 1, borderColor: on ? c : colors.border }}>
                          <Icon name={m.icon} size={15} color={on ? '#fff' : c} />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? '#fff' : c }} numberOfLines={1}>{t(STATUS_KEY[m.status])}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                {/* Tapped name: grade, sheet handed in, note to the parent. */}
                {open && s ? (
                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                    {!s.sheet_excluded ? (
                      <>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>
                          {t('teacher.sheet_grade')}{s.sheet_max_mark != null ? ` (${t('teacher.out_of', { max: s.sheet_max_mark })})` : ''}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                          <TextInput value={gradeDraft} onChangeText={setGradeDraft} keyboardType="numeric" placeholder={t('teacher.optional')} placeholderTextColor={colors.textTertiary}
                            style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 44, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }} />
                          <Button title={t('common.save')} variant="primary" loading={controls.grade.isPending}
                            onPress={() => controls.grade.mutate(
                              { studentId: a.student_id, mark: gradeDraft.trim() ? Number(gradeDraft.trim()) : null },
                              { onError: (e) => fail(e, 'teacher.grade_failed') },
                            )} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: spacing.md }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('teacher.sheet_marked')}</Text>
                          <Switch value={a.sheet_marked} onValueChange={() => controls.sheet.mutate(a.student_id)} trackColor={{ true: colors.brand }} />
                        </View>
                      </>
                    ) : null}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{t('teacher.parent_note')}</Text>
                    <TextInput value={noteDraft} onChangeText={setNoteDraft} placeholder={t('teacher.parent_note_placeholder')} placeholderTextColor={colors.textTertiary} multiline
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minHeight: 64, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, textAlignVertical: 'top' }} />
                    <Button title={t('teacher.save_note')} variant="secondary" loading={controls.note.isPending}
                      onPress={() => controls.note.mutate({ studentId: a.student_id, note: noteDraft.trim() }, { onError: (e) => fail(e, 'common.error') })} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
        </>
      )}

      {sessionId ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button title={t('home.roster_open_full')} onPress={() => onOpenFull(sessionId)} variant="outline" />
        </View>
      ) : null}
    </SheetModal>
  );
}
