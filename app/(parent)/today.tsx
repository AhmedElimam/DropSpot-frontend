import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { formatTime } from '@/utils/format';
import { colors, spacing, radius, shadows, nav, gradients, textPresets } from '@/theme/index';
import { useTodayFeed } from '@/hooks/useTodayFeed';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import type { FeedChild, FeedSession } from '@/api/feed';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.xxl,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.lg,
  ...shadows.sm,
} as const;

function sessionTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // 12h (ص/م) — hour12 + ar-EG to match the app-wide formatTime12 convention.
  return formatTime(d);
}

/**
 * Parent "today" screen (§2) — the live per-child, per-teacher view of today's
 * sessions from /parents/feed. Complements the notifications feed: this is the
 * live "what's happening today", the feed is the durable history.
 */
export default function TodayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useTodayFeed();
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const children = data?.children ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.xl }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Icon name="forward" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.8)', marginStart: spacing.sm }}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff' }}>{t('today.title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
            {t('today.subtitle')}
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />
          ) : children.length === 0 ? (
            <EmptyState icon="calendar" title={t('today.no_sessions')} />
          ) : (
            children.map((child) => <ChildToday key={child.id} child={child} t={t} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ChildToday({ child, t }: { child: FeedChild; t: (k: string) => string }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginStart: spacing.xs }}>{child.name}</Text>
      {child.teachers.map((teacher) => (
        <View key={teacher.teacher_id} style={cardStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Icon name="teacher" size={16} color={colors.textSecondary} outline />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary }}>{teacher.teacher_name ?? ''}</Text>
          </View>
          {teacher.sessions.map((s, i) => (
            <SessionRow key={s.session_instance_id} session={s} last={i === teacher.sessions.length - 1} t={t} />
          ))}
        </View>
      ))}
    </View>
  );
}

function SessionRow({ session, last, t }: { session: FeedSession; last: boolean; t: (k: string) => string }) {
  return (
    <View style={{ paddingVertical: spacing.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderLight }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={textPresets.body}>{session.course_name ?? ''}</Text>
          <Text style={textPresets.caption}>{sessionTime(session.scheduled_at)}</Text>
        </View>
        {session.status ? (
          <StatusBadge status={session.status} />
        ) : (
          <View style={{ backgroundColor: colors.surfaceSunken, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('today.not_recorded')}</Text>
          </View>
        )}
      </View>
      {session.note ? (
        <View style={{ marginTop: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary, marginBottom: 2 }}>{t('today.note_label')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>{session.note}</Text>
        </View>
      ) : null}
    </View>
  );
}
