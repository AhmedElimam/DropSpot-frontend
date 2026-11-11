import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { FlatList, SectionList, ScrollView } from '@/components/ui/Refreshable';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { searchScore } from '@/utils/smartSearch';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/ui/dialog';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/layout/Avatar';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { AddStudentSheet } from '@/components/teacher/AddStudentSheet';
import { useTeacherStudents, useTeacherCourses } from '@/hooks/useStudents';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getTeacherCardOrders, confirmCardOrderReceipt, type TeacherCardOrder, type RosterStudent } from '@/api/students';
import { formatNumber } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { SeasonPaper } from '@/components/SeasonPaper';

type Segment = 'students' | 'cards';
type Quick = 'all' | 'low' | 'overdue' | 'exempt';

// Same bands as everywhere a rate is coloured: ≥ 75 fine, 50–74 slipping, < 50 at risk.
const LOW_RATE = 75;
function rateColor(rate: number | null | undefined): string {
  if (rate == null) return colors.borderStrong;
  if (rate >= LOW_RATE) return colors.success;
  if (rate >= 50) return colors.warning;
  return colors.danger;
}

const CARD_STATUS = (): Record<string, { key: string; color: string }> => ({
  submitted: { key: 'teacher.co_submitted', color: colors.warning },
  approved: { key: 'teacher.co_approved', color: colors.success },
  rejected: { key: 'teacher.co_rejected', color: colors.danger },
  link_generated: { key: 'teacher.co_link', color: colors.textSecondary },
  // Filed by the teacher for a family that never asked: parked until the office
  // releases the batch. Saying "under review" here would be false.
  held: { key: 'teacher.co_held', color: colors.textSecondary },
});

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
      <Avatar name={s.name ?? '—'} seed={avatarSeed.student(s.id, s.name ?? '—')} size={42} />
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
          {/* Let in on a 15-day exemption; a manual check-in grant says so. */}
          {s.exempted ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.infoLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
              <Icon name="shield" size={11} color={colors.infoText} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.infoText }}>
                {s.exemption_source === 'manual_checkin' ? t('students_ui.exempt_manual') : t('students_ui.exempt')}
              </Text>
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

/** The cards list's filter (founder 2026-11-05), by the server's `stage`. */
type CardStage = 'all' | 'progress' | 'delivered' | 'done' | 'rejected';
const STAGE_COLOR = (): Record<string, string> => ({ progress: colors.info, delivered: colors.warning, done: colors.success, rejected: colors.danger });

const CardOrderRow = memo(function CardOrderRow({ o, onConfirm, confirming }: { o: TeacherCardOrder; onConfirm: (o: TeacherCardOrder) => void; confirming: boolean }) {
  const { t } = useTranslation();
  // The server's own words when it sends them; else the old map. Unknown status → say so.
  // Defaulting to "under review" made every status the app had not learned look like a live request.
  const known = CARD_STATUS()[o.status];
  const st = o.status_label
    ? { label: o.status_label, color: STAGE_COLOR()[o.stage ?? 'progress'] ?? colors.textSecondary }
    : { label: t(known?.key ?? 'teacher.co_unknown'), color: known?.color ?? colors.textSecondary };
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
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{st.label}</Text>
      </View>
      {o.can_confirm ? (
        <TouchableOpacity onPress={() => onConfirm(o)} disabled={confirming} accessibilityRole="button" activeOpacity={0.85}
          style={{ marginStart: spacing.xs, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 10 }}>
          {confirming ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t('teacher.co_confirm')}</Text>}
        </TouchableOpacity>
      ) : null}
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
  const [cardStage, setCardStage] = useState<CardStage>('all');
  const [cardSearch, setCardSearch] = useState('');
  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0, progress: 0, delivered: 0, done: 0, rejected: 0 };
    for (const o of cardOrders.data ?? []) { c.all++; c[o.stage ?? 'progress']++; }
    return c;
  }, [cardOrders.data]);
  const shownOrders = useMemo(() => {
    const q = cardSearch.trim();
    return (cardOrders.data ?? []).filter((o) => (cardStage === 'all' || (o.stage ?? 'progress') === cardStage)
      && (!q || searchScore({ name: o.student_name, tags: [o.course_name, o.grade_label] }, q) > 0));
  }, [cardOrders.data, cardStage, cardSearch]);
  const stageOptions = useMemo(() => (['all', 'delivered', 'progress', 'done', 'rejected'] as CardStage[])
    .filter((k) => k === 'all' || stageCounts[k] > 0)
    .map((k) => ({ key: k, label: `${t(`teacher.co_stage_${k}`)} ${formatNumber(stageCounts[k])}` })), [stageCounts, t]);
  const qc = useQueryClient();
  const confirmReceipt = useMutation({
    mutationFn: (o: TeacherCardOrder) => confirmCardOrderReceipt(o.id),
    onSuccess: (message) => { void qc.invalidateQueries({ queryKey: ['teacher-card-orders'] }); Alert.alert(message || t('common.done')); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const askConfirm = useCallback((o: TeacherCardOrder) => Alert.alert(t('teacher.co_confirm_title'), t('teacher.co_confirm_body', { name: o.student_name }), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('teacher.co_confirm'), onPress: () => confirmReceipt.mutate(o) },
  ]), [t, confirmReceipt]);

  const studentsRefresh = usePullRefresh(refetchStudents);
  const cardsRefresh = usePullRefresh(cardOrders.refetch);

  const roster = students ?? [];
  // The overdue flag only arrives for someone who may collect; without it, no tile.
  const seesMoney = roster.some((s) => typeof s.overdue === 'boolean');
  const counts = useMemo(() => ({
    all: roster.length,
    low: roster.filter((s) => s.attendance_rate != null && s.attendance_rate < LOW_RATE).length,
    overdue: roster.filter((s) => s.overdue).length,
    exempt: roster.filter((s) => s.exempted).length,
  }), [roster]);
  useEffect(() => { if ((quick === 'overdue' || quick === 'exempt') && !seesMoney) setQuick('all'); }, [quick, seesMoney]);

  // Search + quick filter run client-side over the loaded roster (course is server-side).
  // The search folds Arabic spelling and matches names, codes, numbers and groups (smartSearch);
  // the best matches lead inside each grade.
  const sections = useMemo(() => {
    const q = search.trim();
    const gradeOrder = new Map<string, number>();
    roster.forEach((s) => { const g = String(s.grade_id ?? 'x'); if (!gradeOrder.has(g)) gradeOrder.set(g, gradeOrder.size); });
    const rows = roster
      .filter((s) => (quick === 'low' ? s.attendance_rate != null && s.attendance_rate < LOW_RATE : quick === 'overdue' ? !!s.overdue : quick === 'exempt' ? !!s.exempted : true))
      .map((s) => ({ s, score: q ? searchScore({ name: s.name, code: s.student_code, phones: [s.phone, ...(s.parent_phones ?? [])], tags: s.course_names }, q) : 1 }))
      .filter((x) => x.score > 0)
      .sort((a, b) => (q ? (gradeOrder.get(String(a.s.grade_id ?? 'x'))! - gradeOrder.get(String(b.s.grade_id ?? 'x'))!) || b.score - a.score : 0))
      .map((x) => x.s);
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
    { key: 'all', label: t('teacher.status_all'), dot: colors.onHero, n: counts.all },
    { key: 'low', label: t('students_ui.tile_low'), dot: colors.warning, n: counts.low },
    ...(seesMoney ? [{ key: 'overdue' as Quick, label: t('students_ui.tile_overdue'), dot: colors.danger, n: counts.overdue }] : []),
    // Students let in on a 15-day exemption (founder 2026-10-04: «track that … the pay filter»).
    ...(seesMoney && counts.exempt > 0 ? [{ key: 'exempt' as Quick, label: t('students_ui.tile_exempt'), dot: colors.info, n: counts.exempt }] : []),
  ];

  const listPad = { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg, paddingTop: spacing.sm };

  return (
    <Surface id="screen.teacher.students" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Compact header (founder: "the header takes a huge chunk of the space"): one line
          for title · count · cards · add, one for search, one for the filter pills. */}
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        {/* «وضع المراجعة»: the season's paper under the header. */}
        <SeasonPaper radius={radius.xl} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.onHero }}>{t(segment === 'cards' ? 'teacher.seg_cards' : 'teacher.tab_students')}</Text>
          {segment === 'students' ? (
            <Surface id="teacher.students.count_pill">
            <View style={{ backgroundColor: colors.onHeroChip, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onHero }}>{formatNumber(counts.all)}</Text>
            </View>
            </Surface>
          ) : null}
          <View style={{ flex: 1 }} />
          {/* «البطاقات» beside the + is hidden on the roster (founder 2026-10-20). A link that opens
              the cards segment directly still shows «الطلاب» here, so nobody is stranded in it. */}
          {segment === 'cards' ? (
          <Surface id="teacher.students.segment_toggle" assistantNeeds="manage_students">
          <TouchableOpacity onPress={() => setSegment('students')} accessibilityRole="button" accessibilityState={{ selected: true }}
            accessibilityLabel={t('teacher.seg_students')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.heroChipActive }}>
            <Icon name="children" size={17} color={colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('teacher.seg_students')}</Text>
          </TouchableOpacity>
          </Surface>
          ) : null}
          <Surface id="teacher.students.add_student" assistantNeeds="manage_students">
          <TouchableOpacity onPress={() => setAddOpen(true)} accessibilityRole="button" accessibilityLabel={t('add_student.title')}
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="add" size={22} color={colors.onAccent} />
          </TouchableOpacity>
          </Surface>
        </View>

        {segment === 'students' ? (
          <>
            <Surface id="teacher.students.search">
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.onHeroChip, borderRadius: radius.lg, paddingHorizontal: spacing.md, marginTop: spacing.sm }}>
              <Icon name="search" size={17} color={colors.onHeroSoft} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('teacher.search_student_ph')}
                placeholderTextColor={colors.onHeroFaint}
                style={{ flex: 1, height: 40, marginStart: spacing.sm, fontFamily: fonts.regular, fontSize: 14, color: colors.onHero, textAlign: 'right', paddingVertical: 0 }}
              />
              {search ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}><Icon name="close" size={16} color={colors.onHeroSoft} /></TouchableOpacity> : null}
            </View>
            </Surface>

            {/* The numbers are the filter — pills now, not tall tiles. A sideways scroll, edge
                to edge: with «معفى» added the pills no longer fit one screen width. */}
            <Surface id="teacher.students.quick_filters">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ marginTop: spacing.sm, marginHorizontal: -spacing.lg }}
              contentContainerStyle={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
              {tiles.map((x) => {
                const on = quick === x.key;
                return (
                  <TouchableOpacity key={x.key} onPress={() => setQuick(on && x.key !== 'all' ? 'all' : x.key)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.heroChipActive : colors.onHeroChip }}>
                    {x.key !== 'all' ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: x.dot }} /> : null}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.onHeroChipActive : colors.onHero }} numberOfLines={1}>{x.label}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.brand : colors.onHeroSoft }}>{formatNumber(x.n)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            </Surface>
          </>
        ) : null}
      </LinearGradient>

      {segment === 'students' ? (
        <>
          {(courses?.length ?? 0) > 1 ? (
            <Surface id="teacher.students.course_chips">
            <View style={{ paddingTop: spacing.sm }}>
              <FilterChips options={courseOptions} value={courseId ?? 0} onChange={(k) => setCourseId(k === 0 ? null : k)} />
            </View>
            </Surface>
          ) : null}

          <Surface id="teacher.students.roster">
          {studentsLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <SectionList showsVerticalScrollIndicator={false}
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
                <Surface id="teacher.students.filter_summary">
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('students_ui.showing', { n: formatNumber(shownCount) })}</Text>
                  <TouchableOpacity onPress={() => { setQuick('all'); setSearch(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} hitSlop={8}>
                    <Icon name="close" size={14} color={colors.brand} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('session_ui.clear_filter')}</Text>
                  </TouchableOpacity>
                </View>
                </Surface>
              ) : null}
              ListEmptyComponent={roster.length
                ? <EmptyState icon="search" title={t('teacher.no_students_in_filter')} />
                : <EmptyState icon="children" title={t('teacher.no_students')} message={t('teacher.no_students_hint')} />}
            />
          )}
          </Surface>
        </>
      ) : (
        <Surface id="teacher.students.cards_segment">
          {/* Orders already filed, and confirming a delivery. Teachers no longer order cards
              (founder 2026-11-05): families order their own; this is reached from the
              «card delivered» notification. */}
          <Surface id="teacher.students.card_orders">
          {cardOrders.isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <FlatList showsVerticalScrollIndicator={false}
              removeClippedSubviews
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              data={shownOrders}
              keyExtractor={(o: TeacherCardOrder) => String(o.id)}
              contentContainerStyle={listPad}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              refreshControl={<RefreshControl refreshing={cardsRefresh.refreshing} onRefresh={cardsRefresh.onRefresh} />}
              ListHeaderComponent={(cardOrders.data ?? []).length > 0 ? (
                <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Icon name="search" size={16} color={colors.textTertiary} />
                    <TextInput value={cardSearch} onChangeText={setCardSearch} placeholder={t('teacher.co_search')} placeholderTextColor={colors.textTertiary}
                      autoCorrect={false} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'right' }} />
                  </View>
                  <FilterChips options={stageOptions} value={cardStage} onChange={(k) => setCardStage(k)} />
                </View>
              ) : null}
              renderItem={({ item }: { item: TeacherCardOrder }) => <CardOrderRow o={item} onConfirm={askConfirm} confirming={confirmReceipt.isPending && confirmReceipt.variables?.id === item.id} />}
              ListEmptyComponent={(cardOrders.data ?? []).length > 0
                ? <EmptyState icon="search" title={t('teacher.co_none_in_filter')} />
                : <EmptyState icon="card" title={t('teacher.no_card_orders')} />}
            />
          )}
          </Surface>
        </Surface>
      )}

      <AddStudentSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
    </Surface>
  );
}
