import { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { useTeacherSessionsWindow } from '@/hooks/useTeacherSessionHistory';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { SessionCard, type SessionCardData } from '@/components/session/TeacherSessionCard';
import { formatNumber, formatDayDate } from '@/utils/format';
import { goToScan } from '@/utils/sessionNav';
import type { TeacherSession } from '@/api/teacher';

const DAY_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTH_FMT = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' });

function key(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** The Egyptian week starts on Saturday. */
function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() + 1) % 7));
}

/**
 * «الحصص» (founder 2026-10-02, second pass). A week strip in the ink header — Saturday to
 * Friday, a dot for each session that day, today ringed in apricot — and the chosen day's
 * sessions underneath as the same cards Home uses. Move a week at a time with the arrows;
 * «اليوم» jumps back. Everything a teacher used to scroll an endless list for is a tap.
 */
export default function TeacherSessions() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { can } = useActiveAbilities();
  const canScan = can(ABILITY.SCAN);

  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState<Date>(today);
  const start = useMemo(() => weekStart(selected), [selected]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const from = key(days[0]);
  const to = key(days[6]);
  const q = useTeacherSessionsWindow(from, to);
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);
  const now = useMinuteClock();

  const byDay = useMemo(() => {
    const m = new Map<string, SessionCardData[]>();
    for (const s of q.data?.items ?? []) {
      const k = s.date ?? (s.scheduled_at ? key(new Date(s.scheduled_at)) : '');
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [q.data]);

  const dayKey = key(selected);
  const list = byDay.get(dayKey) ?? [];
  const present = list.reduce((n, s) => n + (s.checked_in_count ?? 0), 0);
  const roster = list.reduce((n, s) => n + (s.enrolled_count ?? 0), 0);
  const isThisWeek = key(weekStart(today)) === from;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{t('teacher.tab_sessions')}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{MONTH_FMT.format(selected)}</Text>
          </View>
          {!isThisWeek || dayKey !== key(today) ? (
            <TouchableOpacity onPress={() => setSelected(today)} activeOpacity={0.85} style={{ paddingHorizontal: spacing.md, height: 36, borderRadius: radius.full, backgroundColor: colors.accent, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onAccent }}>{t('teacher.today')}</Text>
            </TouchableOpacity>
          ) : null}
          {can(ABILITY.MANAGE_SESSIONS) ? (
            <TouchableOpacity onPress={() => router.push('/(teacher)/schedule-new' as Href)} accessibilityRole="button" accessibilityLabel={t('teacher.add_schedule')} activeOpacity={0.85}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="add" size={22} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Week strip — earlier weeks to the right (RTL), later to the left. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, gap: 4 }}>
          <TouchableOpacity onPress={() => setSelected(addDays(selected, -7))} hitSlop={8} accessibilityLabel={t('session_ui.prev_week')} style={{ padding: 4 }}>
            <Icon name="forward" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
            {days.map((d) => {
              const k = key(d);
              const on = k === dayKey;
              const isToday = k === key(today);
              const count = byDay.get(k)?.length ?? 0;
              return (
                <TouchableOpacity key={k} onPress={() => setSelected(d)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
                  style={{ width: 42, paddingVertical: 8, borderRadius: 14, alignItems: 'center', backgroundColor: on ? '#fff' : 'transparent', borderWidth: isToday && !on ? 1.5 : 0, borderColor: colors.accent }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: on ? colors.textSecondary : 'rgba(255,255,255,0.65)' }}>{DAY_SHORT[d.getDay()]}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: on ? colors.textPrimary : '#fff' }}>{formatNumber(d.getDate())}</Text>
                  <View style={{ flexDirection: 'row', gap: 2, height: 5, marginTop: 2 }}>
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? colors.brand : colors.accent }} />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={() => setSelected(addDays(selected, 7))} hitSlop={8} accessibilityLabel={t('session_ui.next_week')} style={{ padding: 4 }}>
            <Icon name="back" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <SessionCard s={item} now={now} onOpen={(s) => router.push(`/(teacher)/sessions/${s.id}` as Href)} onScan={canScan ? (s) => goToScan(s as TeacherSession) : undefined} />
        )}
        style={{ opacity: q.isPlaceholderData ? 0.5 : 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm }}>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{formatDayDate(selected)}</Text>
            {list.length > 0 ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>
                {t('session_ui.day_summary', { n: formatNumber(list.length) })}
                {roster > 0 ? ` · ${t('session_ui.present_of', { n: formatNumber(present), of: formatNumber(roster) })}` : ''}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : (
            <View style={{ alignItems: 'center', paddingTop: spacing.xl4 }}>
              <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="calendar" size={34} color={colors.accent} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: spacing.md }}>{t('session_ui.no_sessions_day')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>{t('session_ui.pick_another_day')}</Text>
            </View>
          )
        }
      />
    </View>
  );
}
