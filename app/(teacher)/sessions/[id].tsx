import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Switch, Alert, ScrollView, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/layout/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { AttendanceRing } from '@/components/session/AttendanceVisuals';
import { MarkRow, MarksHeader, type SessionKind } from '@/components/session/SessionMarks';
import { sessionPhase } from '@/utils/sessionPhase';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { useSessionDetail, useSessionControls } from '@/hooks/useTeacherSessionHistory';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import type { SessionAttendee, SwapInAttendee } from '@/api/teacherSessions';
import { dayLabel, formatNumber } from '@/utils/format';
import { goToScan } from '@/utils/sessionNav';
import type { TeacherSession } from '@/api/teacher';

type RosterTab = 'roster' | 'swap';
type Bucket = 'awaiting' | 'present' | 'absent' | 'excused';
type Status = 'present' | 'late' | 'absent' | 'excused';

function bucketOf(status: string): Bucket {
  if (status === 'present' || status === 'late') return 'present';
  if (status === 'absent') return 'absent';
  if (status === 'excused') return 'excused';
  return 'awaiting';
}

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
// Rows still to record float to the top: they are what the teacher came here to do.
const ORDER: Record<Bucket, number> = { awaiting: 0, present: 1, absent: 2, excused: 3 };

/**
 * One session's attendance sheet (founder 2026-10-02: "session details needs some love").
 * The header IS the summary: a ring for how full the room is and three counts that double
 * as the filter. Session settings live behind the gear, not stacked above the roster. Rows
 * still to record come first; at the end of a session one button marks the rest absent.
 * Every mark works offline (queued, «بانتظار المزامنة»).
 */
export default function SessionDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: s, isLoading, refetch } = useSessionDetail(id);
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const controls = useSessionControls(id!);
  const { can } = useActiveAbilities();
  const canMark = can(ABILITY.MARK_MANUAL);
  const canScan = can(ABILITY.SCAN);

  const [selected, setSelected] = useState<SessionAttendee | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [gradeDraft, setGradeDraft] = useState('');
  const [tab, setTab] = useState<RosterTab>('roster');
  const [filter, setFilter] = useState<Bucket | null>(null);
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  // «الحضور» = mark who came; «الدرجات» = type every attended student's sheet / exam mark in a row.
  const [mode, setMode] = useState<'attendance' | 'marks'>('attendance');

  const swapIns = s?.swap_ins ?? [];
  const hasSwaps = swapIns.length > 0;
  const activeTab: RosterTab = hasSwaps ? tab : 'roster';
  const baseList: (SessionAttendee | SwapInAttendee)[] = activeTab === 'swap' ? swapIns : s?.attendees ?? [];

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { awaiting: 0, present: 0, absent: 0, excused: 0 };
    for (const a of baseList) c[bucketOf(a.status)]++;
    return c;
  }, [baseList]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseList
      .filter((a) => (filter ? bucketOf(a.status) === filter : true))
      .filter((a) => (!q ? true : (a.name ?? '').toLowerCase().includes(q) || (a.student_code ?? '').toLowerCase().includes(q)))
      .slice()
      .sort((a, b) => ORDER[bucketOf(a.status)] - ORDER[bucketOf(b.status)]);
  }, [baseList, filter, search]);

  // Marks tab: attended students still without a mark first, then the marked, then the rest.
  const marksList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rank = (a: SessionAttendee | SwapInAttendee) => {
      const came = a.status === 'present' || a.status === 'late';
      return !came ? 2 : a.mark == null ? 0 : 1;
    };
    return baseList
      .filter((a) => (!q ? true : (a.name ?? '').toLowerCase().includes(q) || (a.student_code ?? '').toLowerCase().includes(q)))
      .slice()
      .sort((a, b) => rank(a) - rank(b));
  }, [baseList, search]);
  const attendedCount = baseList.filter((a) => a.status === 'present' || a.status === 'late').length;
  const markedCount = baseList.filter((a) => (a.status === 'present' || a.status === 'late') && a.mark != null).length;
  const saveMark = useCallback(async (studentId: number, value: number | null) => {
    try {
      await controls.grade.mutateAsync({ studentId, mark: value });
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.grade_failed'));
      throw e;
    }
  }, [controls.grade, t]);
  const setKind = (k: SessionKind) => controls.setType.mutate(k, { onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.session_type_failed')) });

  const current = selected
    ? s?.attendees.find((a) => a.student_id === selected.student_id) ?? s?.swap_ins?.find((a) => a.student_id === selected.student_id) ?? selected
    : null;

  const openAttendee = (a: SessionAttendee) => {
    setSelected(a);
    setNoteDraft(a.note ?? '');
    setGradeDraft(a.mark != null ? String(a.mark) : '');
  };
  const mark = (studentId: number, status: Status) =>
    controls.mark.mutate({ studentId, status }, { onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.error')) });

  // One rule with the cards: live from 30 min before start until start + length; after that
  // the session has ended even if nobody closed it, so it never reads «جارية الآن» again.
  const now = useMinuteClock();
  const phase = s ? sessionPhase({ status: s.is_cancelled ? 'cancelled' : s.is_completed ? 'completed' : s.status, scheduled_at: s.scheduled_at, duration_minutes: s.duration_minutes }, now) : 'upcoming';
  const started = s?.scheduled_at ? now >= new Date(s.scheduled_at).getTime() : false;
  const live = phase === 'live';
  const awaitingRows = baseList.filter((a) => bucketOf(a.status) === 'awaiting');

  const markRestAbsent = () => {
    if (!awaitingRows.length) return;
    Alert.alert(t('session_ui.rest_absent_title'), t('session_ui.rest_absent_body', { n: formatNumber(awaitingRows.length) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('session_ui.rest_absent_confirm'), style: 'destructive',
        onPress: async () => {
          setBulkBusy(true);
          try {
            for (const a of awaitingRows) {
              // One by one through the same mutation: each mark is queued offline if needed.
              await controls.mark.mutateAsync({ studentId: a.student_id, status: 'absent' }).catch(() => undefined);
            }
          } finally {
            setBulkBusy(false);
          }
        },
      },
    ]);
  };

  const doCancelRestore = () => {
    if (!s) return;
    if (s.is_cancelled) {
      controls.restore.mutate();
    } else {
      Alert.alert(t('teacher.cancel_session_title'), t('teacher.cancel_session_hint'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('teacher.cancel_session_confirm'), style: 'destructive', onPress: () => { setSettingsOpen(false); controls.cancel.mutate(); } },
      ]);
    }
  };

  const renderAttendee = ({ item }: { item: SessionAttendee | SwapInAttendee }) => {
    const color = STATUS_COLOR[item.status] ?? STATUS_COLOR.not_recorded;
    const fromLabel = 'from_label' in item ? item.from_label : null;
    const awaiting = bucketOf(item.status) === 'awaiting';
    return (
      <TouchableOpacity onPress={() => openAttendee(item)} activeOpacity={0.85}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: color, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm, minHeight: 64 }}>
        <Avatar name={item.name ?? '—'} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{item.name ?? '—'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            {!awaiting ? (
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color }}>{t(STATUS_KEY[item.status] ?? 'teacher.not_recorded')}{item.checked_in_at ? ` · ${item.checked_in_at}` : ''}</Text>
            ) : (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{item.student_code ?? (item.card_less ? t('teacher.card_less') : '')}</Text>
            )}
            {item.pending_sync ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.warningText }}>{`· ${t('teacher.mark_pending_sync')}`}</Text> : null}
            {item.mark != null ? <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.brand }}>{`· ${t('teacher.mark_short', { mark: item.mark })}`}</Text> : null}
            {item.sheet_awaited ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.warning }}>{`· ${t('teacher.sheet_awaited')}`}</Text> : null}
            {item.note ? <Icon name="note" size={12} color={colors.textTertiary} /> : null}
            {item.number_flagged ? <Icon name="warning" size={12} color={colors.danger} /> : null}
          </View>
          {fromLabel ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.brand, marginTop: 2 }} numberOfLines={1}>{t('teacher.swapped_from', { from: fromLabel })}</Text> : null}
        </View>
        {canMark ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['present', 'absent'] as const).map((st) => {
              const on = item.status === st || (st === 'present' && item.status === 'late');
              const c = st === 'present' ? colors.success : colors.danger;
              return (
                <TouchableOpacity key={st} onPress={() => mark(item.student_id, st)} hitSlop={4} accessibilityLabel={t(STATUS_KEY[st])}
                  style={{ width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? c : c + '14', borderWidth: on ? 0 : 1, borderColor: c + '55' }}>
                  <Icon name={st === 'present' ? 'present' : 'absent'} size={22} color={on ? '#fff' : c} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const stats: { key: Bucket; label: string; color: string }[] = [
    { key: 'present', label: t('session_ui.stat_present'), color: colors.success },
    { key: 'absent', label: t('session_ui.stat_absent'), color: colors.danger },
    { key: 'awaiting', label: t('session_ui.stat_awaiting'), color: colors.accent },
  ];
  const total = baseList.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header — the session at a glance; the counts are the filter. */}
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="forward" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {s ? (
            <TouchableOpacity onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel={t('session_ui.settings')} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="settings" size={20} color="#fff" outline />
            </TouchableOpacity>
          ) : null}
        </View>

        {s ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {phase === 'cancelled' ? <Chip label={t('session.cancelled')} bg={colors.danger} />
                    : phase === 'done' ? <Chip label={t('session.completed')} bg="rgba(255,255,255,0.2)" />
                    : phase === 'live' ? <Chip label={t('teacher.live_now')} bg={colors.success} />
                    : <Chip label={t('session_ui.upcoming')} bg="rgba(255,255,255,0.2)" />}
                  {s.is_exam ? <Chip label={t('teacher.type_quiz_exam')} bg={colors.accent} dark /> : null}
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginTop: 6 }} numberOfLines={2}>{s.course_name ?? t('session.session_details')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                  {dayLabel(s.scheduled_at)}{s.time ? ` · ${s.time}` : ''}{s.location ? ` · ${s.location}` : ''}
                </Text>
              </View>
              <AttendanceRing present={counts.present} total={total} onDark size={84} />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              {stats.map((x) => {
                const on = filter === x.key;
                return (
                  <TouchableOpacity key={x.key} onPress={() => setFilter(on ? null : x.key)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={{ flex: 1, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: on ? '#fff' : 'rgba(255,255,255,0.14)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.color }} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, color: on ? colors.textPrimary : '#fff' }}>{formatNumber(counts[x.key])}</Text>
                    </View>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: on ? colors.textSecondary : 'rgba(255,255,255,0.72)' }}>{x.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}
      </LinearGradient>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !s ? (
        <EmptyState icon="calendar" title={t('teacher.session_not_found')} />
      ) : (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <FlatList
          data={mode === 'marks' ? marksList : list}
          keyExtractor={(a) => String(a.student_id)}
          renderItem={mode === 'marks'
            ? ({ item }) => <MarkRow a={item} max={s.sheet_max_mark} onSave={saveMark} />
            : renderAttendee}
          // Clipping detaches off-screen rows, which drops a focused mark field's keyboard on Android.
          removeClippedSubviews={mode !== 'marks'} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + 72 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
              {/* Two tabs on one session: who came, and their marks. */}
              <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: 4, borderWidth: 1, borderColor: colors.border }}>
                {([['attendance', 'attendance', t('marks_ui.tab_attendance'), null], ['marks', 'grades', t('marks_ui.tab_marks'), attendedCount > 0 ? `${formatNumber(markedCount)}/${formatNumber(attendedCount)}` : null]] as const).map(([k, icon, label, badge]) => {
                  const on = mode === k;
                  return (
                    <TouchableOpacity key={k} onPress={() => setMode(k)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
                      style={{ flex: 1, minHeight: 40, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: on ? colors.brand : 'transparent' }}>
                      <Icon name={icon} size={16} color={on ? '#fff' : colors.textSecondary} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: on ? '#fff' : colors.textSecondary }}>{label}</Text>
                      {badge ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>{badge}</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {mode === 'marks' ? (
                <MarksHeader kind={(s.type ?? 'normal_sheet') as SessionKind} kindBusy={controls.setType.isPending} onKind={setKind}
                  max={s.sheet_max_mark} onMax={(v) => controls.sheetMax.mutate(v)} done={markedCount} of={attendedCount} />
              ) : null}
              {s.offline ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.md }}>
                  <Icon name="offline" size={18} color={colors.warningText} />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.warningText }}>{t('teacher.roster_offline_hint')}</Text>
                </View>
              ) : null}

              {hasSwaps ? (
                <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: 4 }}>
                  {([['roster', t('teacher.tab_roster'), s.attendees.length], ['swap', t('teacher.tab_swaps'), swapIns.length]] as const).map(([k, label, n]) => {
                    const on = activeTab === k;
                    return (
                      <TouchableOpacity key={k} onPress={() => { setTab(k); setFilter(null); }} activeOpacity={0.85}
                        style={{ flex: 1, minHeight: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.surface : 'transparent' }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.brand : colors.textSecondary }}>{`${label} · ${formatNumber(n)}`}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {total > 8 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
                  <Icon name="search" size={18} color={colors.textTertiary} />
                  <TextInput value={search} onChangeText={setSearch} placeholder={t('teacher.search_student_ph')} placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, height: 44, marginStart: spacing.sm, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary }} />
                  {search ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}><Icon name="close" size={16} color={colors.textTertiary} /></TouchableOpacity> : null}
                </View>
              ) : null}

              {mode === 'attendance' && canMark && started && !s.is_cancelled && awaitingRows.length > 0 ? (
                <TouchableOpacity onPress={markRestAbsent} disabled={bulkBusy} activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.dangerLight, borderRadius: radius.lg, padding: spacing.md }}>
                  {bulkBusy ? <ActivityIndicator color={colors.danger} /> : <Icon name="absent" size={20} color={colors.danger} />}
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.dangerText }}>{t('session_ui.rest_absent', { n: formatNumber(awaitingRows.length) })}</Text>
                </TouchableOpacity>
              ) : null}

              {filter && mode === 'attendance' ? (
                <TouchableOpacity onPress={() => setFilter(null)} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 }}>
                  <Icon name="close" size={14} color={colors.brand} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('session_ui.clear_filter')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          ListEmptyComponent={<EmptyState icon="children" title={baseList.length ? t('teacher.no_students_in_filter') : t('teacher.no_students')} />}
          keyboardDismissMode="on-drag"
        />
        </KeyboardAvoidingView>
      )}

      {/* Scan straight into this session. */}
      {s && canScan && live && mode === 'attendance' ? (
        <TouchableOpacity onPress={() => goToScan({ id: s.id, course_name: s.course_name } as TeacherSession)} activeOpacity={0.9} accessibilityRole="button"
          style={{ position: 'absolute', bottom: nav.bottomHeight + insets.bottom + spacing.sm, end: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8, height: 54, paddingHorizontal: spacing.xl, borderRadius: 27, backgroundColor: colors.success, ...shadows.md }}>
          <Icon name="scan" size={22} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('sessions_tab.scan')}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Session settings — type, sheet, cancel. Out of the way of the roster. */}
      <Modal visible={settingsOpen && !!s} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSettingsOpen(false)} />
          {s ? (
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('session_ui.settings')}</Text>

              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm }}>{t('teacher.session_type_label')}</Text>
                <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: 4 }}>
                  {(['normal_sheet', 'quiz_exam'] as const).map((ty) => {
                    const on = (s.type ?? 'normal_sheet') === ty;
                    return (
                      <TouchableOpacity key={ty} disabled={controls.setType.isPending} activeOpacity={0.85}
                        onPress={() => { if (!on) controls.setType.mutate(ty, { onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.session_type_failed')) }); }}
                        style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: on ? colors.surface : 'transparent', alignItems: 'center' }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.brand : colors.textSecondary }}>{t(ty === 'normal_sheet' ? 'teacher.type_normal_sheet' : 'teacher.type_quiz_exam')}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {s.is_exam ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>{t('teacher.type_quiz_exam_hint')}</Text> : null}
              </View>

              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('teacher.sheet_excluded_label')}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('teacher.sheet_excluded_hint')}</Text>
                  </View>
                  <Switch value={s.sheet_excluded} onValueChange={() => controls.sheetExcluded.mutate()} trackColor={{ true: colors.brand }} />
                </View>
                {!s.sheet_excluded ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('teacher.sheet_max_label')}</Text>
                    <SheetMaxEditor value={s.sheet_max_mark} onSave={(v) => controls.sheetMax.mutate(v)} />
                  </View>
                ) : null}
              </View>

              <Button
                title={s.is_cancelled ? t('teacher.restore_session') : t('teacher.cancel_session')}
                onPress={doCancelRestore}
                variant={s.is_cancelled ? 'success' : 'destructive'}
                loading={controls.cancel.isPending || controls.restore.isPending}
                disabled={s.is_completed}
              />
            </View>
          ) : null}
        </View>
      </Modal>

      {/* One student — mark, sheet grade, note. */}
      <Modal visible={!!current} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSelected(null)} />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
            {current ? (
              <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
                <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
                  <Avatar name={current.name ?? '—'} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{current.name ?? '—'}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{current.student_code ?? (current.card_less ? t('teacher.card_less') : '')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelected(null)} accessibilityLabel={t('common.close')} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
                    <Icon name="close" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {canMark ? (
                  <>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('teacher.mark_attendance')}</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                      {MARK_OPTIONS.map((o) => {
                        const active = current.status === o.status;
                        return (
                          <TouchableOpacity key={o.status} onPress={() => mark(current.student_id, o.status)} disabled={controls.mark.isPending}
                            style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: active ? o.color : o.color + '12', borderWidth: active ? 0 : 1, borderColor: o.color + '55' }}>
                            <Icon name={o.icon} size={22} color={active ? '#fff' : o.color} />
                            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? '#fff' : o.color }}>{t(STATUS_KEY[o.status])}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>
                  {t('teacher.sheet_grade')}{s?.sheet_max_mark != null ? ` (${t('teacher.out_of', { max: s.sheet_max_mark })})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                  <TextInput value={gradeDraft} onChangeText={setGradeDraft} keyboardType="numeric" placeholder={t('teacher.optional')} placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }} />
                  <Button title={t('common.save')} variant="primary" loading={controls.grade.isPending}
                    onPress={() => controls.grade.mutate(
                      { studentId: current.student_id, mark: gradeDraft.trim() ? Number(gradeDraft.trim()) : null },
                      { onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.grade_failed')) },
                    )} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('teacher.sheet_marked')}</Text>
                  <Switch value={current.sheet_marked} onValueChange={() => controls.sheet.mutate(current.student_id)} trackColor={{ true: colors.brand }} />
                </View>

                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('teacher.parent_note')}</Text>
                <TextInput value={noteDraft} onChangeText={setNoteDraft} placeholder={t('teacher.parent_note_placeholder')} placeholderTextColor={colors.textTertiary} multiline
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minHeight: 80, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, textAlignVertical: 'top' }} />
                <View style={{ marginTop: spacing.md }}>
                  <Button title={t('teacher.save_note')} variant="secondary" loading={controls.note.isPending}
                    onPress={() => controls.note.mutate({ studentId: current.student_id, note: noteDraft.trim() })} />
                </View>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Chip({ label, bg, dark = false }: { label: string; bg: string; dark?: boolean }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 9 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: dark ? colors.onAccent : '#fff' }}>{label}</Text>
    </View>
  );
}

/** Inline editor for the per-session sheet cap: a small numeric field, saved on blur. */
function SheetMaxEditor({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  return (
    <TextInput value={draft} onChangeText={setDraft} keyboardType="numeric" placeholder={t('teacher.optional')} placeholderTextColor={colors.textTertiary}
      style={{ width: 72, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, paddingHorizontal: spacing.sm, height: 40, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'center' }}
      onBlur={() => onSave(draft.trim() ? Number(draft.trim()) : null)} />
  );
}
