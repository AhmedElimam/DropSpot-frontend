import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, layout } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import type { TeacherSession } from '@/api/teacher';
import { getTeacherInsights } from '@/api/insights';
import { useOfflineStore } from '@/stores/offlineStore';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatTile } from '@/components/ui/StatTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { OverridesSection } from '@/components/teacher/OverridesSection';
import { TeacherSwitcher } from '@/components/teacher/TeacherSwitcher';
import { PendingInvitations } from '@/components/teacher/PendingInvitations';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatDate } from '@/utils/format';
import { toArabicDigits } from '@/utils/numerals';
import { formatEGP } from '@/utils/currency';

// Home's "current" HIGHLIGHT window — a UI convenience only. A session lights up
// 30 min before its start through its scheduled end. This is DELIBERATELY separate
// from the backend check-in validation window (10 min before / 15 after); the two
// must never reference each other (spec Directive 3).
const HIGHLIGHT_BEFORE_MIN = 30;

function isHighlighted(s: TeacherSession, now: number): boolean {
  if (s.is_current) return true;
  if (!s.scheduled_at) return false;
  const start = new Date(s.scheduled_at).getTime();
  if (Number.isNaN(start)) return false;
  const end = start + (s.duration_minutes ?? 60) * 60_000;
  return now >= start - HIGHLIGHT_BEFORE_MIN * 60_000 && now <= end;
}

function goToScan(session: TeacherSession) {
  router.push(`/(teacher)/scan?name=${encodeURIComponent(session.course_name ?? '')}&id=${session.id}` as Href);
}

/** Header: greeting + date/count on the right, bell + avatar on the left. */
function HomeHeader({ name, subtitle, onBell, unread }: { name: string; subtitle: string; onBell: () => void; unread: number }) {
  const { t } = useTranslation();
  const initial = (name || '?').trim().charAt(0) || '؟';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 23, color: colors.ink, letterSpacing: -0.3 }} numberOfLines={1}>
          {t('common.greeting', { name })}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 3 }} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TouchableOpacity onPress={onBell} accessibilityRole="button" style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={22} color={colors.ink} outline />
          {unread > 0 ? <View style={{ position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, borderWidth: 1, borderColor: colors.surface }} /> : null}
        </TouchableOpacity>
        <View style={{ width: 44, height: 44, borderRadius: 15, overflow: 'hidden' }}>
          <LinearGradient colors={gradients.brandCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{initial}</Text>
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

/** Section header: bold title on the right, optional count/action on the left. */
function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction} hitSlop={8} disabled={!onAction}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** A single action/alert row (reconcile, enroll, collect). */
function ActionCard({ icon, tone = 'brand', title, subtitle, onPress }: { icon: IconName; tone?: 'brand' | 'warn'; title: string; subtitle: string; onPress: () => void }) {
  const warn = tone === 'warn';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: warn ? colors.warnWash : colors.surface,
        borderWidth: 1, borderColor: warn ? '#F7E1C6' : colors.line,
        borderRadius: radius.card, padding: 15, ...(warn ? null : shadows.sm),
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: warn ? '#fff' : colors.brandWash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={warn ? colors.warn : colors.brand} outline />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Icon name="back" size={16} color={colors.faint} />
    </TouchableOpacity>
  );
}

export default function TeacherHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: unread } = useUnreadCount();
  const { data: sessions, isLoading, refetch } = useTeacherTodaySessions();
  const pending = useOfflineStore((s) => s.pending);
  const rejected = useOfflineStore((s) => s.rejected);
  const needsAttention = pending + rejected; // scans to sync OR to decide on (§2)
  const { isAssistant, can } = useActiveAbilities();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const now = Date.now();

  // Quick-stats strip — teacher-only (financial figures never shown to assistants).
  const { data: insights } = useQuery({
    queryKey: ['teacher-insights'],
    queryFn: getTeacherInsights,
    enabled: !isAssistant,
    staleTime: 60_000,
  });

  const today = useMemo(
    () => [...(sessions ?? [])].sort((a, b) => +new Date(a.scheduled_at ?? 0) - +new Date(b.scheduled_at ?? 0)),
    [sessions],
  );
  const featured = useMemo(() => today.find((s) => isHighlighted(s, now)) ?? today.find((s) => s.status !== 'completed') ?? null, [today, now]);
  const featuredLive = featured ? isHighlighted(featured, now) : false;

  const dateSub = `${formatDate(new Date())}${today.length ? ` · ${t('teacher.sessions_today_n', { count: today.length })}` : ''}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: insets.top + spacing.md, paddingBottom: layout.tabBottom + insets.bottom, gap: layout.sectionGap }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <HomeHeader name={user?.name || ''} subtitle={dateSub} onBell={() => router.push('/(teacher)/notifications' as Href)} unread={unread ?? 0} />

        {/* Assistant context chip + pending work-consent invitations (both self-hide). */}
        <View style={{ gap: layout.cardGap }}>
          <TeacherSwitcher />
          <PendingInvitations />
          {needsAttention > 0 ? (
            <ActionCard
              icon="warning"
              tone="warn"
              title={pending > 0 ? t('teacher.pending_scans', { count: pending }) : t('teacher.rejected_title', { count: rejected })}
              subtitle={t('teacher.tap_to_reconcile')}
              onPress={() => router.push('/(teacher)/reconcile' as Href)}
            />
          ) : null}
        </View>

        {/* HERO — the live / next session + scan CTA */}
        <LinearGradient colors={gradients.brandCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.hero, padding: spacing.xl, ...shadows.hero, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(255,255,255,0.07)', top: -96, left: -58 }} />
          {featured ? (
            <>
              <View style={{ flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: spacing.md }}>
                {featuredLive ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#5BE9A6' }} /> : null}
                <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: '#fff' }}>
                  {featuredLive ? t('teacher.live_now') : t('teacher.next_session')}
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: '#fff', marginTop: 13, lineHeight: 27 }}>{featured.course_name ?? '—'}</Text>
              {(featured.time || featured.location) ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.87)', marginTop: 5 }}>
                  {featured.time ?? ''}{featured.location ? ` · ${featured.location}` : ''}
                </Text>
              ) : null}
              <TouchableOpacity onPress={() => goToScan(featured)} activeOpacity={0.9} style={{ marginTop: 18, height: 48, borderRadius: 15, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
                <Icon name="scan" size={18} color={colors.brand} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.brand }}>{t('teacher.scan_attendance')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Icon name="calendar" size={40} color="rgba(255,255,255,0.85)" outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff', marginTop: spacing.md }}>{t('teacher.no_sessions_today')}</Text>
            </View>
          )}
        </LinearGradient>

        {/* Quick actions — enroll (ability-gated) + collect (teacher-only) */}
        {(can(ABILITY.MANAGE_STUDENTS) || !isAssistant) ? (
          <View style={{ gap: layout.cardGap }}>
            {can(ABILITY.MANAGE_STUDENTS) ? (
              <ActionCard icon="add" title={t('teacher.enroll_card_title')} subtitle={t('teacher.enroll_card_sub')} onPress={() => router.push('/(teacher)/enroll' as Href)} />
            ) : null}
            {!isAssistant ? (
              <ActionCard icon="money" title={t('teacher.collect_title')} subtitle={t('teacher.collect_sub')} onPress={() => router.push('/(teacher)/collect' as Href)} />
            ) : null}
          </View>
        ) : null}

        {/* Today's sessions */}
        <View style={{ gap: layout.cardGap }}>
          <SectionHeader title={t('teacher.todays_sessions')} />
          {isLoading ? (
            <SkeletonList count={3} />
          ) : !today.length ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line }}>
              <EmptyState icon="calendar" title={t('teacher.no_sessions_today')} message={t('teacher.no_sessions_hint')} />
            </View>
          ) : (
            today.map((s) => {
              const live = isHighlighted(s, now);
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => goToScan(s)}
                  activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: live ? 1.5 : 1, borderColor: live ? colors.brand : colors.line, padding: 14, ...shadows.sm }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: live ? colors.brand : colors.brandWash, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="scan" size={22} color={live ? '#fff' : colors.brand} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.ink }}>{s.course_name ?? '—'}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      {s.time ?? ''}{s.location ? ` · ${s.location}` : ''}
                    </Text>
                  </View>
                  {live ? (
                    <View style={{ backgroundColor: colors.goodWash, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: 10 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.good }}>{t('teacher.live_now')}</Text>
                    </View>
                  ) : (
                    <Icon name="scan" size={18} color={colors.faint} outline />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Quick look — teacher-only stat strip */}
        {!isAssistant && insights ? (
          <View style={{ gap: layout.cardGap }}>
            <SectionHeader title={t('teacher.quick_look')} action={t('common.view_all')} onAction={() => router.push('/(teacher)/insights' as Href)} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatTile label={t('teacher.stat_attendance')} value={`${toArabicDigits(Math.round(insights.attendance.rate))}٪`} tone="brand" progress={insights.attendance.rate / 100} />
              <StatTile label={t('teacher.stat_active')} value={insights.attendance.active_students} tone="success" />
              <StatTile label={t('teacher.stat_overdue')} value={formatEGP(insights.financial.overdue)} tone="warning" />
            </View>
          </View>
        ) : null}

        <OverridesSection />
      </ScrollView>
    </View>
  );
}
