import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { StudentRow } from '@/components/student/StudentRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTeacherStudents, useTeacherCourses } from '@/hooks/useStudents';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { useTeacherSessionHistory } from '@/hooks/useTeacherSessionHistory';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import type { SessionRow } from '@/api/teacherSessions';
import { getTeacherCardOrders, type TeacherCardOrder } from '@/api/students';
import { dayLabel } from '@/utils/format';

type Segment = 'students' | 'sessions' | 'cards';

const CARD_STATUS: Record<string, { key: string; color: string }> = {
  submitted: { key: 'teacher.co_submitted', color: colors.warning },
  approved: { key: 'teacher.co_approved', color: colors.success },
  rejected: { key: 'teacher.co_rejected', color: colors.danger },
  link_generated: { key: 'teacher.co_link', color: colors.textSecondary },
};

// Backend session status → an existing session.* i18n key + a chip variant.
const SESSION_STATUS: Record<string, { key: string; color: string }> = {
  scheduled: { key: 'session.scheduled', color: colors.info },
  in_progress: { key: 'session.live', color: colors.success },
  live: { key: 'session.live', color: colors.success },
  completed: { key: 'session.completed', color: colors.textSecondary },
  cancelled: { key: 'session.cancelled', color: colors.danger },
};

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: spacing.lg,
        minHeight: 40,
        justifyContent: 'center',
        borderRadius: radius.full,
        backgroundColor: active ? colors.brand : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        marginEnd: spacing.sm,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: active ? '#fff' : colors.textSecondary }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function TeacherStudents() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('students');
  const [courseId, setCourseId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const { can } = useActiveAbilities();
  const { data: courses } = useTeacherCourses();
  const { data: students, isLoading: studentsLoading, refetch: refetchStudents } =
    useTeacherStudents({ course_id: courseId ?? undefined });
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } =
    useTeacherSessionHistory(status ?? undefined);
  const cardOrders = useQuery({ queryKey: ['teacher-card-orders'], queryFn: getTeacherCardOrders, enabled: segment === 'cards' });

  // Each segment has its own list + RefreshControl, so keep the pull-refresh per segment.
  const studentsRefresh = usePullRefresh(refetchStudents);
  const sessionsRefresh = usePullRefresh(refetchSessions);
  const cardsRefresh = usePullRefresh(cardOrders.refetch);

  // Search filters the loaded roster client-side (grade filter is server-side).
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students ?? [];
    return (students ?? []).filter(
      (s) => (s.name ?? '').toLowerCase().includes(q) || (s.student_code ?? '').toLowerCase().includes(q),
    );
  }, [students, search]);

  const listPad = { paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom, paddingTop: spacing.sm };

  const renderSession = ({ item }: { item: SessionRow }) => {
    const st = SESSION_STATUS[item.status] ?? { key: 'session.scheduled', color: colors.textSecondary };
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(teacher)/students/session/${item.id}` as Href)}
        activeOpacity={0.8}
        style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
            {item.course_name ?? '—'}
          </Text>
          <View style={{ backgroundColor: st.color, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 10 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#fff' }}>{t(st.key)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
            {dayLabel(item.scheduled_at)}{item.time ? ` · ${item.time}` : ''}{item.location ? ` · ${item.location}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
          <Icon name="present" size={16} color={colors.success} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>
            {t('teacher.checked_in_count', { count: item.checked_in_count })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Title */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary }}>{t('teacher.tab_students')}</Text>
      </View>

      {/* Segmented: students / sessions / cards */}
      <View style={{ flexDirection: 'row', marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: 4, marginBottom: spacing.sm }}>
        {(['students', 'sessions', 'cards'] as Segment[]).map((seg) => (
          <TouchableOpacity
            key={seg}
            onPress={() => setSegment(seg)}
            activeOpacity={0.85}
            style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: segment === seg ? colors.surface : 'transparent', alignItems: 'center' }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: segment === seg ? colors.brand : colors.textSecondary }}>
              {t(seg === 'students' ? 'teacher.seg_students' : seg === 'sessions' ? 'teacher.seg_sessions' : 'teacher.seg_cards')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {segment === 'students' ? (
        <>
          {/* Search */}
          <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
            <Icon name="search" size={18} color={colors.textTertiary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('teacher.search_student_ph')}
              placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, height: 46, marginStart: spacing.sm, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}
            />
          </View>

          {/* Course filter chips — the teacher scopes by "which of my classes". */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }} style={{ flexGrow: 0 }}>
            <Chip label={t('teacher.all_courses')} active={courseId === null} onPress={() => setCourseId(null)} />
            {(courses ?? []).map((c) => (
              <Chip key={c.id} label={c.name} active={courseId === c.id} onPress={() => setCourseId(c.id)} />
            ))}
          </ScrollView>

          {studentsLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <FlatList
              data={filteredStudents}
              keyExtractor={(s) => s.id}
              contentContainerStyle={listPad}
              refreshControl={<RefreshControl refreshing={studentsRefresh.refreshing} onRefresh={studentsRefresh.onRefresh} />}
              renderItem={({ item }) => (
                <StudentRow
                  id={item.id}
                  name={item.name ?? '—'}
                  studentCode={item.student_code ?? ''}
                  grade={item.grade_name ?? undefined}
                  attendanceRate={item.attendance_rate ?? undefined}
                  onPress={(id) => router.push(`/(teacher)/students/${id}` as Href)}
                />
              )}
              ListEmptyComponent={<EmptyState icon="children" title={t('teacher.no_students')} message={t('teacher.no_students_hint')} />}
            />
          )}
        </>
      ) : segment === 'sessions' ? (
        <>
          {/* Session tools — teachers always; assistants only with manage_sessions
              on their active teacher context. Add a weekly slot, or pause a range. */}
          {can(ABILITY.MANAGE_SESSIONS) && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.sm }}>
              <TouchableOpacity
                onPress={() => router.push('/(teacher)/schedule-new' as Href)}
                activeOpacity={0.85}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.surface }}
              >
                <Icon name="add" size={18} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('teacher.add_schedule')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(teacher)/pause' as Href)}
                activeOpacity={0.85}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <Icon name="clock" size={18} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary }}>{t('teacher.pause_period')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Session status chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }} style={{ flexGrow: 0 }}>
            <Chip label={t('teacher.status_all')} active={status === null} onPress={() => setStatus(null)} />
            {(['scheduled', 'completed', 'cancelled'] as const).map((s) => (
              <Chip key={s} label={t(`session.${s}`)} active={status === s} onPress={() => setStatus(s)} />
            ))}
          </ScrollView>

          {sessionsLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <FlatList
              data={sessions?.items ?? []}
              keyExtractor={(s) => s.id}
              contentContainerStyle={listPad}
              refreshControl={<RefreshControl refreshing={sessionsRefresh.refreshing} onRefresh={sessionsRefresh.onRefresh} />}
              renderItem={renderSession}
              ListEmptyComponent={<EmptyState icon="calendar" title={t('teacher.no_sessions_history')} message={t('teacher.no_sessions_history_hint')} />}
            />
          )}
        </>
      ) : (
        <>
          {/* Card orders — order a card for an existing enrollment + track requests. */}
          <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm }}>
            <TouchableOpacity
              onPress={() => router.push('/(teacher)/card-order-new' as Href)}
              activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.brand }}
            >
              <Icon name="add" size={18} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('teacher.order_card')}</Text>
            </TouchableOpacity>
          </View>

          {cardOrders.isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <FlatList
              data={cardOrders.data ?? []}
              keyExtractor={(o: TeacherCardOrder) => String(o.id)}
              contentContainerStyle={listPad}
              refreshControl={<RefreshControl refreshing={cardsRefresh.refreshing} onRefresh={cardsRefresh.onRefresh} />}
              renderItem={({ item }: { item: TeacherCardOrder }) => {
                const st = CARD_STATUS[item.status] ?? { key: 'teacher.co_submitted', color: colors.textSecondary };
                return (
                  <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{item.student_name}</Text>
                      <View style={{ backgroundColor: st.color, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 10 }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#fff' }}>{t(st.key)}</Text>
                      </View>
                    </View>
                    {item.course_name || item.grade_label ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                        {item.course_name ?? item.grade_label}
                      </Text>
                    ) : null}
                  </View>
                );
              }}
              ListEmptyComponent={<EmptyState icon="children" title={t('teacher.no_card_orders')} message={t('teacher.order_card_sub')} />}
            />
          )}
        </>
      )}
    </View>
  );
}
