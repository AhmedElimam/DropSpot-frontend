import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, SectionList, ActivityIndicator, RefreshControl } from 'react-native';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/layout/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { AddStudentSheet } from '@/components/teacher/AddStudentSheet';
import { useTeacherStudents, useTeacherCourses } from '@/hooks/useStudents';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getTeacherCardOrders, type TeacherCardOrder, type RosterStudent } from '@/api/students';
import { formatNumber } from '@/utils/format';

type Segment = 'students' | 'cards';
type Quick = 'all' | 'low' | 'overdue';

// Same bands as everywhere a rate is coloured: ≥ 75 fine, 50–74 slipping, < 50 at risk.
const LOW_RATE = 75;
function rateColor(rate: number | null | undefined): string {
  if (rate == null) return colors.borderStrong;
  if (rate >= LOW_RATE) return colors.success;
  if (rate >= 50) return colors.warning;
  return colors.danger;
}

const CARD_STATUS: Record<string, { key: string; color: string }> = {
  submitted: { key: 'teacher.co_submitted', color: colors.warning },
  approved: { key: 'teacher.co_approved', color: colors.success },
  rejected: { key: 'teacher.co_rejected', color: colors.danger },
  link_generated: { key: 'teacher.co_link', color: colors.textSecondary },
  // Filed by the teacher for a family that never asked: parked until the office
  // releases the batch. Saying "under review" here would be false.
  held: { key: 'teacher.co_held', color: colors.textSecondary },
};

/**
 * One roster row. Module-level and memoised with primitive-ish props: the roster filters
 * client-side on every keystroke, and an inline row re-rendered every mounted row per
 * character (Android heat, 2026-09-22). The start stripe and the rate pill carry the
 * attendance band; an overdue bill (the thing that stops them at the door) is a red chip.
 */
const RosterRow = memo(function RosterRow({ s, onPress }: { s: RosterStudent; onPress: (id: string) => void }) {
  const { t } = useTranslation();
  const color = rateColor(s.attendance_rate);
  return (
    <TouchableOpacity
      onPress={() => onPress(s.id)}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: color, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm, minHeight: 66 }}
    >
      <Avatar name={s.name ?? '—'} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{s.name ?? '—'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>{s.student_code ?? ''}</Text>
          {s.overdue ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.dangerLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
              <Icon name="money" size={11} color={colors.dangerText} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.dangerText }}>{t('students_ui.overdue')}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {s.attendance_rate != null ? (
        <View style={{ alignItems: 'center', minWidth: 54 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color }}>{`${formatNumber(s.attendance_rate)}٪`}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textTertiary }}>
            {t('students_ui.attended_of', { n: formatNumber(s.attendance_attended), of: formatNumber(s.attendance_total) })}
          </Text>
        </View>
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary, minWidth: 54, textAlign: 'center' }}>{t('students_ui.no_sessions_yet')}</Text>
      )}
      <Icon name="back" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
});

const CardOrderRow = memo(function CardOrderRow({ o }: { o: TeacherCardOrder }) {
  const { t } = useTranslation();
  // Unknown status → say so. Defaulting to "under review" made every status the app had
  // not learned yet look like a live request.
  const st = CARD_STATUS[o.status] ?? { key: 'teacher.co_unknown', color: colors.textSecondary };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: st.color, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: st.color + '1A', justifyContent: 'center', alignItems: 'center' }}>
        <Icon name="card" size={20} color={st.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{o.student_name}</Text>
        {o.course_name || o.grade_label ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{o.course_name ?? o.grade_label}</Text>
        ) : null}
      </View>
      <View style={{ backgroundColor: st.color, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 10 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{t(st.key)}</Text>
      </View>
    </View>
  );
});

/**
 * «الطلاب» (second pass, founder 2026-10-02: "needs some love"). Ink header with the
 * roster in numbers — everyone · low attendance · overdue — and those numbers ARE the
 * filter, like the session sheet. Search lives in the header, the course chips under it,
 * and the list is grouped by grade (the server already orders it grade → name).
 */
export default function TeacherStudents() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // A notification about a card order lands on the cards segment directly.
  const { segment: askedSegment } = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<Segment>(askedSegment === 'cards' ? 'cards' : 'students');
  useEffect(() => { if (askedSegment === 'cards' || askedSegment === 'students') setSegment(askedSegment); }, [askedSegment]);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<Quick>('all');
  const [addOpen, setAddOpen] = useState(false);

  const { can } = useActiveAbilities();
  const canStudents = can(ABILITY.MANAGE_STUDENTS);
  const { data: courses } = useTeacherCourses();
  const { data: students, isLoading: studentsLoading, refetch: refetchStudents, isPlaceholderData: studentsSwitching } =
    useTeacherStudents({ course_id: courseId ?? undefined });

  // A course that no longer exists (deleted, or another teacher's context after a switch)
  // must not leave the roster filtered by a chip nobody can see.
  useEffect(() => {
    if (courseId !== null && courses && !courses.some((c) => c.id === courseId)) setCourseId(null);
  }, [courses, courseId]);
  // Same for the cards segment when the ability that shows it is gone (or still loading).
  useEffect(() => {
    if (segment === 'cards' && !canStudents) setSegment('students');
  }, [segment, canStudents]);
  const courseOptions = useMemo(
    () => [{ key: 0, label: t('teacher.all_courses') }, ...(courses ?? []).map((c) => ({ key: c.id, label: c.name }))],
    [courses, t],
  );
  const cardOrders = useQuery({ queryKey: ['teacher-card-orders'], queryFn: getTeacherCardOrders, enabled: segment === 'cards' });

  const studentsRefresh = usePullRefresh(refetchStudents);
  const cardsRefresh = usePullRefresh(cardOrders.refetch);

  const roster = students ?? [];
  // The overdue flag only arrives for someone who may collect; without it, no tile.
  const seesMoney = roster.some((s) => typeof s.overdue === 'boolean');
  const counts = useMemo(() => ({
    all: roster.length,
    low: roster.filter((s) => s.attendance_rate != null && s.attendance_rate < LOW_RATE).length,
    overdue: roster.filter((s) => s.overdue).length,
  }), [roster]);
  useEffect(() => { if (quick === 'overdue' && !seesMoney) setQuick('all'); }, [quick, seesMoney]);

  // Search + quick filter run client-side over the loaded roster (course is server-side).
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = roster
      .filter((s) => (quick === 'low' ? s.attendance_rate != null && s.attendance_rate < LOW_RATE : quick === 'overdue' ? !!s.overdue : true))
      .filter((s) => !q || (s.name ?? '').toLowerCase().includes(q) || (s.student_code ?? '').toLowerCase().includes(q));
    const out: { key: string; title: string; data: RosterStudent[] }[] = [];
    for (const s of rows) {
      const title = s.grade_name ?? t('students_ui.no_grade');
      const last = out[out.length - 1];
      if (last && last.title === title) last.data.push(s);
      else out.push({ key: `${s.grade_id ?? 'x'}-${out.length}`, title, data: [s] });
    }
    return out;
  }, [roster, search, quick, t]);
  const shownCount = sections.reduce((n, x) => n + x.data.length, 0);

  const openStudent = useCallback((id: string) => {
    router.push(`/(teacher)/students/${id}` as Href);
  }, []);
  const renderStudent = useCallback(({ item }: { item: RosterStudent }) => <RosterRow s={item} onPress={openStudent} />, [openStudent]);

  const tiles: { key: Quick; label: string; dot: string; n: number }[] = [
    { key: 'all', label: t('teacher.status_all'), dot: '#fff', n: counts.all },
    { key: 'low', label: t('students_ui.tile_low'), dot: colors.warning, n: counts.low },
    ...(seesMoney ? [{ key: 'overdue' as Quick, label: t('students_ui.tile_overdue'), dot: colors.danger, n: counts.overdue }] : []),
  ];

  const listPad = { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg, paddingTop: spacing.sm };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Compact header (founder: "the header takes a huge chunk of the space"): one line
          for title · count · cards · add, one for search, one for the filter pills. */}
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{t(segment === 'cards' ? 'teacher.seg_cards' : 'teacher.tab_students')}</Text>
          {segment === 'students' ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{formatNumber(counts.all)}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {canStudents ? (
            <TouchableOpacity onPress={() => setSegment(segment === 'cards' ? 'students' : 'cards')} accessibilityRole="button" accessibilityState={{ selected: segment === 'cards' }}
              accessibilityLabel={t(segment === 'cards' ? 'teacher.seg_students' : 'teacher.seg_cards')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 10, borderRadius: 12, backgroundColor: segment === 'cards' ? '#fff' : 'rgba(255,255,255,0.14)' }}>
              <Icon name={segment === 'cards' ? 'children' : 'card'} size={17} color={segment === 'cards' ? colors.brand : '#fff'} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: segment === 'cards' ? colors.brand : '#fff' }}>{t(segment === 'cards' ? 'teacher.seg_students' : 'teacher.seg_cards')}</Text>
            </TouchableOpacity>
          ) : null}
          {canStudents ? (
            <TouchableOpacity onPress={() => setAddOpen(true)} accessibilityRole="button" accessibilityLabel={t('add_student.title')}
              style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="add" size={22} color={colors.onAccent} />
            </TouchableOpacity>
          ) : null}
        </View>

        {segment === 'students' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, paddingHorizontal: spacing.md, marginTop: spacing.sm }}>
              <Icon name="search" size={17} color="rgba(255,255,255,0.7)" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('teacher.search_student_ph')}
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={{ flex: 1, height: 40, marginStart: spacing.sm, fontFamily: fonts.regular, fontSize: 14, color: '#fff', textAlign: 'right', paddingVertical: 0 }}
              />
              {search ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}><Icon name="close" size={16} color="rgba(255,255,255,0.7)" /></TouchableOpacity> : null}
            </View>

            {/* The numbers are the filter — pills now, not tall tiles. */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              {tiles.map((x) => {
                const on = quick === x.key;
                return (
                  <TouchableOpacity key={x.key} onPress={() => setQuick(on && x.key !== 'all' ? 'all' : x.key)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.1)' }}>
                    {x.key !== 'all' ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: x.dot }} /> : null}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.textPrimary : '#fff' }} numberOfLines={1}>{x.label}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.brand : 'rgba(255,255,255,0.75)' }}>{formatNumber(x.n)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}
      </LinearGradient>

      {segment === 'students' ? (
        <>
          {(courses?.length ?? 0) > 1 ? (
            <View style={{ paddingTop: spacing.sm }}>
              <FilterChips options={courseOptions} value={courseId ?? 0} onChange={(k) => setCourseId(k === 0 ? null : k)} />
            </View>
          ) : null}

          {studentsLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(s) => s.id}
              renderItem={renderStudent}
              stickySectionHeadersEnabled={false}
              removeClippedSubviews
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={7}
              keyboardShouldPersistTaps="handled"
              // The previous course's list stays up, dimmed, while the new one loads.
              style={{ opacity: studentsSwitching ? 0.45 : 1 }}
              contentContainerStyle={listPad}
              refreshControl={<RefreshControl refreshing={studentsRefresh.refreshing} onRefresh={studentsRefresh.onRefresh} />}
              renderSectionHeader={({ section }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{section.title}</Text>
                  <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.brand }}>{formatNumber(section.data.length)}</Text>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </View>
              )}
              ListHeaderComponent={quick !== 'all' || search ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('students_ui.showing', { n: formatNumber(shownCount) })}</Text>
                  <TouchableOpacity onPress={() => { setQuick('all'); setSearch(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} hitSlop={8}>
                    <Icon name="close" size={14} color={colors.brand} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('session_ui.clear_filter')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              ListEmptyComponent={roster.length
                ? <EmptyState icon="search" title={t('teacher.no_students_in_filter')} />
                : <EmptyState icon="children" title={t('teacher.no_students')} message={t('teacher.no_students_hint')} />}
            />
          )}
        </>
      ) : (
        <>
          {/* Card orders — order a card for an existing enrolment + track requests. */}
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm }}>
            <TouchableOpacity
              onPress={() => router.push('/(teacher)/card-order-new' as Href)}
              activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.brand }}
            >
              <Icon name="add" size={18} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('teacher.order_card')}</Text>
            </TouchableOpacity>
          </View>

          {cardOrders.isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <FlatList
              removeClippedSubviews
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              data={cardOrders.data ?? []}
              keyExtractor={(o: TeacherCardOrder) => String(o.id)}
              contentContainerStyle={listPad}
              refreshControl={<RefreshControl refreshing={cardsRefresh.refreshing} onRefresh={cardsRefresh.onRefresh} />}
              renderItem={({ item }: { item: TeacherCardOrder }) => <CardOrderRow o={item} />}
              ListEmptyComponent={<EmptyState icon="card" title={t('teacher.no_card_orders')} message={t('teacher.order_card_sub')} />}
            />
          )}
        </>
      )}

      <AddStudentSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}
