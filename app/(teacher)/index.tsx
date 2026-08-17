import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import type { TeacherSession } from '@/api/teacher';
import { useOfflineStore } from '@/stores/offlineStore';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { OverridesSection } from '@/components/teacher/OverridesSection';
import { TeacherSwitcher } from '@/components/teacher/TeacherSwitcher';
import { PendingInvitations } from '@/components/teacher/PendingInvitations';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { usePullRefresh } from '@/hooks/usePullRefresh';

// Home's "current" HIGHLIGHT window — a UI convenience only. A session lights up
// 30 min before its start through its scheduled end. This is DELIBERATELY separate
// from the backend check-in validation window (10 min before / 15 after); the two
// must never reference each other (spec Directive 3).
const HIGHLIGHT_BEFORE_MIN = 30;

function isHighlighted(s: TeacherSession, now: number): boolean {
  if (!s.scheduled_at) return false;
  const start = new Date(s.scheduled_at).getTime();
  if (Number.isNaN(start)) return false;
  const end = start + (s.duration_minutes ?? 60) * 60_000;
  const windowOpens = start - HIGHLIGHT_BEFORE_MIN * 60_000;
  return now >= windowOpens && now <= end;
}

function goToScan(session: TeacherSession) {
  router.push(`/(teacher)/scan?name=${encodeURIComponent(session.course_name ?? '')}&id=${session.id}` as Href);
}

export default function TeacherHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: sessions, isLoading, refetch } = useTeacherTodaySessions();
  const pending = useOfflineStore((s) => s.pending);
  const rejected = useOfflineStore((s) => s.rejected);
  const needsAttention = pending + rejected; // scans to sync OR to decide on (§2)
  const { isAssistant, can } = useActiveAbilities();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const now = Date.now();

  const renderSession = (s: TeacherSession) => {
    const highlighted = isHighlighted(s, now);
    return (
      <TouchableOpacity
        key={s.id}
        onPress={() => goToScan(s)}
        activeOpacity={0.8}
        style={{
          backgroundColor: highlighted ? colors.successLight : colors.surface,
          borderRadius: radius.xl,
          borderWidth: highlighted ? 1.5 : 1,
          borderColor: highlighted ? colors.success : colors.border,
          padding: spacing.lg,
          marginBottom: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          ...shadows.sm,
          minHeight: 68,
        }}
      >
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: highlighted ? colors.success : colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
          <Icon name="scan" size={24} color={highlighted ? '#fff' : colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{s.course_name ?? '—'}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
            {s.time ?? ''}{s.location ? ` · ${s.location}` : ''}
          </Text>
        </View>
        {highlighted ? (
          <View style={{ backgroundColor: colors.success, borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t('teacher.live_now')}</Text>
          </View>
        ) : (
          <Icon name="scan" size={20} color={colors.textTertiary} outline />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{t('teacher.today')}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginTop: 2 }}>{user?.name ?? ''}</Text>
            {/* Active-teacher chip — only shows for multi-relationship assistants. */}
            <TeacherSwitcher />
          </View>
          <TouchableOpacity onPress={() => logout.mutate()} accessibilityRole="button" accessibilityLabel={t('common.logout')} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="logout" size={22} color="#fff" outline />
          </TouchableOpacity>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          {/* Assistant consent: pending invitations to work for a teacher. */}
          <PendingInvitations />
          {needsAttention > 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/(teacher)/reconcile' as Href)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: colors.warningLight, borderRadius: radius.xl,
                borderWidth: 1, borderColor: colors.warning, padding: spacing.lg, marginBottom: spacing.lg,
              }}
            >
              <Icon name="warning" size={24} color={colors.warningText} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.warningText }}>
                  {pending > 0 ? t('teacher.pending_scans', { count: pending }) : t('teacher.rejected_title', { count: rejected })}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.warningText }}>{t('teacher.tap_to_reconcile')}</Text>
              </View>
              <Icon name="back" size={20} color={colors.warningText} />
            </TouchableOpacity>
          ) : null}
          {/* Enroll (invite student) — requires the manage_students ability. */}
          {can(ABILITY.MANAGE_STUDENTS) ? (
            <TouchableOpacity
              onPress={() => router.push('/(teacher)/enroll' as Href)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: colors.surface, borderRadius: radius.xl,
                borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg,
              }}
            >
              <Icon name="add" size={24} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>تسجيل طالب بالبطاقة</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>امسح رمز QR على البطاقة لتسجيله في حصة</Text>
              </View>
              <Icon name="back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {/* Payment collection is financial — NEVER shown to an assistant on mobile. */}
          {!isAssistant ? (
            <TouchableOpacity
              onPress={() => router.push('/(teacher)/collect' as Href)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: colors.surface, borderRadius: radius.xl,
                borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg,
              }}
            >
              <Icon name="money" size={24} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>تحصيل الدفعات</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>امسح البطاقة لتحصيل الفاتورة أو الملزمة</Text>
              </View>
              <Icon name="back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.md }}>{t('teacher.todays_sessions')}</Text>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : !sessions?.length ? (
            <EmptyState icon="calendar" title={t('teacher.no_sessions_today')} message={t('teacher.no_sessions_hint')} />
          ) : (
            sessions.map(renderSession)
          )}

          <OverridesSection />
        </View>
      </ScrollView>
    </View>
  );
}
