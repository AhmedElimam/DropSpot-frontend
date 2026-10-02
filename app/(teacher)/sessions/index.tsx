import { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { useTeacherSessionHistory } from '@/hooks/useTeacherSessionHistory';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import type { SessionRow } from '@/api/teacherSessions';
import type { TeacherSession } from '@/api/teacher';
import { dayLabel } from '@/utils/format';
import { isSessionHighlighted, goToScan } from '@/utils/sessionNav';

const SESSION_STATUS: Record<string, { key: string; color: string }> = {
  scheduled: { key: 'session.scheduled', color: colors.info },
  in_progress: { key: 'session.live', color: colors.success },
  live: { key: 'session.live', color: colors.success },
  completed: { key: 'session.completed', color: colors.textSecondary },
  cancelled: { key: 'session.cancelled', color: colors.danger },
};

/**
 * «الحصص» — its own tab (founder 2026-10-02: the attendance sheet sat under Students, which
 * is where nobody looked for it). Today first, then the history with status chips; every
 * row opens the sheet (manual marks work offline) or the scanner for whoever scans.
 */
export default function TeacherSessions() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { can } = useActiveAbilities();
  const canScan = can(ABILITY.SCAN);
  const [status, setStatus] = useState<string | null>(null);
  const today = useTeacherTodaySessions();
  const history = useTeacherSessionHistory(status ?? undefined);
  const { refreshing, onRefresh } = usePullRefresh(today.refetch, history.refetch);
  const now = Date.now();

  const statusOptions = useMemo(
    () => [{ key: 'all', label: t('teacher.status_all') }, ...(['scheduled', 'completed', 'cancelled'] as const).map((k) => ({ key: k as string, label: t(`session.${k}`) }))],
    [t],
  );

  const openSheet = (id: string) => router.push(`/(teacher)/sessions/${id}` as Href);

  const renderToday = (s: TeacherSession) => {
    const live = isSessionHighlighted(s, now);
    return (
      <TouchableOpacity key={s.id} onPress={() => openSheet(s.id)} activeOpacity={0.85}
        style={{ backgroundColor: live ? colors.successLight : colors.surface, borderRadius: radius.xl, borderWidth: live ? 1.5 : 1, borderColor: live ? colors.success : colors.border, padding: spacing.lg, marginBottom: spacing.sm, ...shadows.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={1}>{s.course_name ?? '—'}</Text>
          {live ? (
            <View style={{ backgroundColor: colors.success, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 10 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t('teacher.live_now')}</Text>
            </View>
          ) : s.cycle_position ? (
            <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('teacher.position_of', { n: s.cycle_position.n, of: s.cycle_position.of })}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
          {s.time ?? ''}{s.location ? ` · ${s.location}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          {canScan ? (
            <TouchableOpacity onPress={() => goToScan(s)} activeOpacity={0.85} accessibilityRole="button"
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.lg, backgroundColor: live ? colors.success : colors.brand }}>
              <Icon name="scan" size={18} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('sessions_tab.scan')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => openSheet(s.id)} activeOpacity={0.85} accessibilityRole="button"
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.lg, borderWidth: 1.5, borderColor: live ? colors.success : colors.brand, backgroundColor: colors.surface }}>
            <Icon name="attendance" size={18} color={live ? colors.success : colors.brand} outline />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: live ? colors.success : colors.brand }}>{t('sessions_tab.sheet')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHistory = ({ item }: { item: SessionRow }) => {
    const st = SESSION_STATUS[item.status] ?? { key: 'session.scheduled', color: colors.textSecondary };
    return (
      <TouchableOpacity onPress={() => openSheet(item.id)} activeOpacity={0.8}
        style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{item.course_name ?? '—'}</Text>
          <View style={{ backgroundColor: st.color, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 10 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#fff' }}>{t(st.key)}</Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
          {dayLabel(item.scheduled_at)}{item.time ? ` · ${item.time}` : ''}{item.location ? ` · ${item.location}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Icon name="present" size={15} color={colors.success} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('teacher.checked_in_count', { count: item.checked_in_count })}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const todayList = today.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary }}>{t('teacher.tab_sessions')}</Text>
        {can(ABILITY.MANAGE_SESSIONS) ? (
          <TouchableOpacity onPress={() => router.push('/(teacher)/schedule-new' as Href)} accessibilityRole="button" accessibilityLabel={t('teacher.add_schedule')} activeOpacity={0.85}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="add" size={22} color={colors.brand} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={history.data?.items ?? []}
        keyExtractor={(s) => s.id}
        renderItem={renderHistory}
        style={{ opacity: history.isPlaceholderData ? 0.45 : 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
        ListHeaderComponent={
          <View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>{t('teacher.todays_sessions')}</Text>
            {today.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : todayList.length === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('teacher.no_sessions_today')}</Text>
              </View>
            ) : todayList.map(renderToday)}

            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.xs }}>{t('sessions_tab.history')}</Text>
            <View style={{ marginHorizontal: -spacing.lg, paddingBottom: spacing.sm }}>
              <FilterChips options={statusOptions} value={status ?? 'all'} onChange={(k) => setStatus(k === 'all' ? null : k)} />
            </View>
            {history.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}
          </View>
        }
        ListEmptyComponent={history.isLoading ? null : <EmptyState icon="calendar" title={t('teacher.no_sessions_history')} message={t('teacher.no_sessions_history_hint')} />}
      />
    </View>
  );
}
