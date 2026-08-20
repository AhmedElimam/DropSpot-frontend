import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, layout } from '@/theme/index';
import { useStudentSessions } from '@/hooks/useSessions';
import { useUnreadCount } from '@/hooks/useNotifications';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatTime, formatDayDate, relativeDay } from '@/utils/format';
import { toArabicDigits } from '@/utils/numerals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Timeline, type TimelineItem, type TimelineState } from '@/components/ui/Timeline';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { SessionInstance } from '@/types/session-instance';

type Filter = 'all' | 'upcoming' | 'past';

function sessionState(s: SessionInstance): TimelineState {
  if (s.attendance_status === 'absent' || s.status === 'cancelled') return 'missed';
  if (s.attendance_status || s.status === 'completed') return 'done';
  const start = +new Date(s.scheduled_at);
  const now = Date.now();
  if (now >= start - 15 * 60000 && now <= start + 60 * 60000) return 'now';
  return 'upcoming';
}

export default function StudentSessions() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const { data: sessions, isLoading, refetch } = useStudentSessions();
  const { data: unread } = useUnreadCount();
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const list = sessions ?? [];

  const filtered = useMemo(() => {
    const now = Date.now();
    if (filter === 'upcoming') return list.filter((s) => s.status === 'scheduled' && +new Date(s.scheduled_at) >= now);
    if (filter === 'past') return list.filter((s) => s.status === 'completed' || +new Date(s.scheduled_at) < now);
    return list;
  }, [list, filter]);

  // Group by calendar day; newest day first (today at the top, past below).
  const days = useMemo(() => {
    const map = new Map<string, { key: string; date: Date; items: SessionInstance[] }>();
    for (const s of filtered) {
      const d = new Date(s.scheduled_at);
      const key = d.toDateString();
      let g = map.get(key);
      if (!g) { g = { key, date: d, items: [] }; map.set(key, g); }
      g.items.push(s);
    }
    const groups = Array.from(map.values());
    groups.forEach((g) => g.items.sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at)));
    groups.sort((a, b) => +b.date - +a.date);
    return groups;
  }, [filtered]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'upcoming', label: t('session.filter_upcoming') },
    { key: 'past', label: t('session.filter_past') },
  ];

  const toItems = (items: SessionInstance[]): TimelineItem[] => items.map((s) => ({
    id: s.id,
    state: sessionState(s),
    time: formatTime(s.scheduled_at),
    title: `${s.course_name} — ${s.teacher_name}`,
    subtitle: s.location ?? undefined,
    chip: s.attendance_status ? <StatusBadge status={s.attendance_status} size="sm" /> : undefined,
    onPress: () => router.navigate('/(student)/check-in'),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: insets.top + spacing.md, paddingBottom: layout.tabBottom + insets.bottom, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Header: title + week count on the right, bell on the left */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 23, color: colors.ink, letterSpacing: -0.3 }}>{t('session.my_sessions')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 }}>{t('session.this_week', { count: list.length })}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.navigate('/(student)/notifications' as never)}
            style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="bell" size={22} color={colors.ink} outline />
            {(unread ?? 0) > 0 ? <View style={{ position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, borderWidth: 1, borderColor: colors.surface }} /> : null}
          </TouchableOpacity>
        </View>

        {/* Filter pills */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {filters.map((f) => {
            const on = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{ paddingVertical: 8, paddingHorizontal: spacing.lg, borderRadius: radius.chip, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.line }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.muted }}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <SkeletonList count={4} />
        ) : days.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line }}>
            <EmptyState icon="calendar" title={t('session.no_sessions')} />
          </View>
        ) : (
          days.map((g) => (
            <View key={g.key} style={{ gap: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.muted, marginStart: 2 }}>
                {relativeDay(g.date) ? `${relativeDay(g.date)} · ${formatDayDate(g.date)}` : formatDayDate(g.date)}
              </Text>
              <Timeline items={toItems(g.items)} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
