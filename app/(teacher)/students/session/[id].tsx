import { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Switch, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/layout/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSessionDetail, useSessionControls } from '@/hooks/useTeacherSessionHistory';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import type { SessionAttendee, SwapInAttendee } from '@/api/teacherSessions';
import { dayLabel } from '@/utils/format';

type RosterTab = 'roster' | 'swap';
type AttnFilter = 'awaiting' | 'present' | 'absent' | 'excused' | 'all';

/** Which filter bucket an attendance status falls into. */
function attnBucket(status: string): Exclude<AttnFilter, 'all'> {
  if (status === 'present' || status === 'late') return 'present';
  if (status === 'absent') return 'absent';
  if (status === 'excused') return 'excused';
  return 'awaiting'; // not_recorded / anything else = still to fill in
}

const FILTER_ORDER: AttnFilter[] = ['awaiting', 'present', 'absent', 'excused', 'all'];

const STATUS_META: Record<string, { key: string; variant: BadgeVariant }> = {
  present: { key: 'attendance.present', variant: 'success' },
  late: { key: 'attendance.late', variant: 'warning' },
  absent: { key: 'attendance.absent', variant: 'danger' },
  excused: { key: 'attendance.excused', variant: 'info' },
  not_recorded: { key: 'teacher.not_recorded', variant: 'default' },
};

const MARK_OPTIONS: { status: 'present' | 'late' | 'absent' | 'excused'; color: string }[] = [
  { status: 'present', color: colors.success },
  { status: 'late', color: colors.warning },
  { status: 'absent', color: colors.danger },
  { status: 'excused', color: colors.info },
];

export default function SessionDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: s, isLoading, refetch, isRefetching } = useSessionDetail(id);
  const controls = useSessionControls(id!);
  const { can } = useActiveAbilities();
  const canMark = can(ABILITY.MARK_MANUAL);

  const [selected, setSelected] = useState<SessionAttendee | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [gradeDraft, setGradeDraft] = useState('');
  // Tabs + attendance filter (parity with the web dashboard). Default tab is the
  // roster; default filter is "awaiting" — the still-empty rows to fill in.
  const [tab, setTab] = useState<RosterTab>('roster');
  const [filter, setFilter] = useState<AttnFilter>('awaiting');

  const swapIns = s?.swap_ins ?? [];
  const hasSwaps = swapIns.length > 0;
  const activeTab: RosterTab = hasSwaps ? tab : 'roster'; // never strand on an empty swap tab
  const baseList: (SessionAttendee | SwapInAttendee)[] = activeTab === 'swap' ? swapIns : s?.attendees ?? [];

  // Per-filter counts over the active tab's list, for the pill labels.
  const counts = useMemo(() => {
    const c = { awaiting: 0, present: 0, absent: 0, excused: 0, all: baseList.length };
    for (const a of baseList) c[attnBucket(a.status)]++;
    return c;
  }, [baseList]);

  const filteredList = useMemo(
    () => (filter === 'all' ? baseList : baseList.filter((a) => attnBucket(a.status) === filter)),
    [baseList, filter],
  );

  const openAttendee = (a: SessionAttendee) => {
    setSelected(a);
    setNoteDraft(a.note ?? '');
    setGradeDraft(a.mark != null ? String(a.mark) : '');
  };
  // Keep the open sheet's data fresh after a mutation returns new detail — search
  // the roster AND the swap-in list (a makeup student can be marked here too).
  const current = selected
    ? s?.attendees.find((a) => a.student_id === selected.student_id)
      ?? s?.swap_ins?.find((a) => a.student_id === selected.student_id)
      ?? selected
    : null;

  const doCancelRestore = () => {
    if (!s) return;
    if (s.is_cancelled) {
      controls.restore.mutate();
    } else {
      Alert.alert(t('teacher.cancel_session_title'), t('teacher.cancel_session_hint'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('teacher.cancel_session_confirm'), style: 'destructive', onPress: () => controls.cancel.mutate() },
      ]);
    }
  };

  const renderAttendee = ({ item }: { item: SessionAttendee | SwapInAttendee }) => {
    const meta = STATUS_META[item.status] ?? STATUS_META.not_recorded;
    const fromLabel = 'from_label' in item ? item.from_label : null;
    return (
      <TouchableOpacity
        onPress={() => openAttendee(item)}
        activeOpacity={0.8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}
      >
        <Avatar name={item.name ?? '—'} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{item.name ?? '—'}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
            {item.student_code ?? (item.card_less ? t('teacher.card_less') : '')}
            {item.checked_in_at ? ` · ${item.checked_in_at}` : ''}
          </Text>
          {fromLabel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Icon name="refresh" size={12} color={colors.brand} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.brand }} numberOfLines={1}>{t('teacher.swapped_from', { from: fromLabel })}</Text>
            </View>
          ) : null}
          {/* Sheet + note signals */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: item.mark != null || item.note || item.sheet_awaited || item.number_flagged ? 4 : 0 }}>
            {item.mark != null ? (
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.brand }}>{t('teacher.mark_short', { mark: item.mark })}</Text>
            ) : null}
            {item.sheet_awaited ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.warning }}>{t('teacher.sheet_awaited')}</Text> : null}
            {item.note ? <Icon name="note" size={13} color={colors.textTertiary} /> : null}
            {item.number_flagged ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger }}>{t('teacher.number_fake')}</Text> : null}
          </View>
        </View>
        <Badge label={t(meta.key)} variant={meta.variant} size="sm" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }} numberOfLines={1}>{s?.course_name ?? t('session.session_details')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !s ? (
        <EmptyState icon="calendar" title={t('teacher.session_not_found')} />
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(a) => String(a.student_id)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md }}>
              {/* Summary card */}
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                    {dayLabel(s.scheduled_at)}{s.time ? ` · ${s.time}` : ''}{s.location ? ` · ${s.location}` : ''}
                  </Text>
                  {s.is_cancelled ? <Badge label={t('session.cancelled')} variant="danger" size="sm" /> : s.is_completed ? <Badge label={t('session.completed')} variant="default" size="sm" /> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
                  <Icon name="present" size={18} color={colors.success} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>
                    {t('teacher.present_of_total', { present: s.present_count, total: s.total_count })}
                  </Text>
                </View>
              </View>

              {/* Session controls */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={s.is_cancelled ? t('teacher.restore_session') : t('teacher.cancel_session')}
                    onPress={doCancelRestore}
                    variant={s.is_cancelled ? 'success' : 'destructive'}
                    loading={controls.cancel.isPending || controls.restore.isPending}
                    disabled={s.is_completed}
                  />
                </View>
              </View>

              {/* Sheet controls */}
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingEnd: spacing.md }}>
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

              {/* Tabs: enrolled roster (default) + swapped-in makeups (only when any) */}
              {hasSwaps ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                  {([['roster', t('teacher.tab_roster'), s.total_count], ['swap', t('teacher.tab_swaps'), swapIns.length]] as const).map(([key, label, n]) => {
                    const on = activeTab === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setTab(key)}
                        activeOpacity={0.8}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border }}
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.textSecondary }}>{label}</Text>
                        <View style={{ minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: on ? 'rgba(255,255,255,0.25)' : colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: on ? '#fff' : colors.textTertiary }}>{n}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginTop: spacing.lg }}>{t('teacher.roster')}</Text>
              )}

              {/* Attendance filter — default "awaiting" (still to fill in) */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                {FILTER_ORDER.map((f) => {
                  const on = filter === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setFilter(f)}
                      activeOpacity={0.8}
                      style={{ paddingHorizontal: spacing.md, height: 34, borderRadius: radius.full, justifyContent: 'center', backgroundColor: on ? colors.primaryLight : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.border }}
                    >
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: on ? colors.primary : colors.textSecondary }}>
                        {t(`teacher.filter_${f}`)} · {counts[f]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          }
          renderItem={renderAttendee}
          ListEmptyComponent={
            baseList.length > 0
              ? <EmptyState icon="children" title={t('teacher.no_students_in_filter')} />
              : <EmptyState icon="children" title={t('teacher.no_students')} />
          }
        />
      )}

      {/* Attendee action sheet */}
      <Modal visible={!!current} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
            {current ? (
              <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
                  <Avatar name={current.name ?? '—'} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{current.name ?? '—'}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{current.student_code ?? (current.card_less ? t('teacher.card_less') : '')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelected(null)} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
                    <Icon name="back" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Manual attendance */}
                {canMark ? (
                  <>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('teacher.mark_attendance')}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
                      {MARK_OPTIONS.map((o) => {
                        const active = current.status === o.status;
                        return (
                          <TouchableOpacity
                            key={o.status}
                            onPress={() => controls.mark.mutate({ studentId: current.student_id, status: o.status })}
                            disabled={controls.mark.isPending}
                            style={{ paddingHorizontal: spacing.lg, height: 44, justifyContent: 'center', borderRadius: radius.full, backgroundColor: active ? o.color : colors.surface, borderWidth: 1.5, borderColor: o.color }}
                          >
                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: active ? '#fff' : o.color }}>{t(STATUS_META[o.status].key)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                {/* Sheet grade (only meaningful once attending) */}
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>
                  {t('teacher.sheet_grade')}{s?.sheet_max_mark != null ? ` (${t('teacher.out_of', { max: s.sheet_max_mark })})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                  <TextInput
                    value={gradeDraft}
                    onChangeText={setGradeDraft}
                    keyboardType="numeric"
                    placeholder={t('teacher.optional')}
                    placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}
                  />
                  <Button
                    title={t('common.save')}
                    onPress={() => controls.grade.mutate(
                      { studentId: current.student_id, mark: gradeDraft.trim() ? Number(gradeDraft.trim()) : null },
                      { onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('teacher.grade_failed')) },
                    )}
                    loading={controls.grade.isPending}
                    variant="primary"
                  />
                </View>

                {/* Sheet-marked toggle */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('teacher.sheet_marked')}</Text>
                  <Switch value={current.sheet_marked} onValueChange={() => controls.sheet.mutate(current.student_id)} trackColor={{ true: colors.brand }} />
                </View>

                {/* Parent note */}
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('teacher.parent_note')}</Text>
                <TextInput
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder={t('teacher.parent_note_placeholder')}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minHeight: 80, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top' }}
                />
                <View style={{ marginTop: spacing.md }}>
                  <Button
                    title={t('teacher.save_note')}
                    onPress={() => controls.note.mutate({ studentId: current.student_id, note: noteDraft.trim() })}
                    loading={controls.note.isPending}
                    variant="secondary"
                  />
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Inline editor for the per-session sheet cap: a small numeric field + save. */
function SheetMaxEditor({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        keyboardType="numeric"
        placeholder={t('teacher.optional')}
        placeholderTextColor={colors.textTertiary}
        style={{ width: 72, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, paddingHorizontal: spacing.sm, height: 40, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'center' }}
        onBlur={() => onSave(draft.trim() ? Number(draft.trim()) : null)}
      />
    </View>
  );
}
