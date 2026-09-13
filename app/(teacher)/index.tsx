import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import type { TeacherSession } from '@/api/teacher';
import { useOfflineStore } from '@/stores/offlineStore';
import { Icon } from '@/components/ui/Icon';
import { HeaderBrandBar } from '@/components/ui/HeaderBrandBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { OverridesSection } from '@/components/teacher/OverridesSection';
import { TeacherSwitcher } from '@/components/teacher/TeacherSwitcher';
import { PendingInvitations } from '@/components/teacher/PendingInvitations';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { usePhoneConfirmations } from '@/hooks/usePhoneConfirmations';

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
  const { data: unread } = useUnreadCount();
  const { data: flags } = useFeatureFlags();
  const { data: sessions, isLoading, refetch } = useTeacherTodaySessions();
  const pending = useOfflineStore((s) => s.pending);
  const rejected = useOfflineStore((s) => s.rejected);
  const needsAttention = pending + rejected; // scans to sync OR to decide on (§2)
  const { can } = useActiveAbilities();
  // «أرقام تحتاج تأكيد» — no ability gate: the assistant who typed the number at the
  // door is the one who can still ask the family, so both roles reach it by default.
  const { data: phoneConfirmations, refetch: refetchNumbers } = usePhoneConfirmations();
  const unconfirmedNumbers = phoneConfirmations?.count ?? 0;
  const { refreshing, onRefresh } = usePullRefresh(refetch, refetchNumbers);
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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl }}
        >
          <HeaderBrandBar onBell={() => router.push('/(teacher)/notifications' as Href)} unread={unread} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{t('teacher.today')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginTop: 2 }}>{user?.name ?? ''}</Text>
          {/* Active-teacher chip — only shows for multi-relationship assistants. */}
          <TeacherSwitcher />
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
          {/* «أرقام تحتاج تأكيد» (phone-verification spec §5). Sits directly under the
              scans banner because it shares its nature: a small queue that only a human
              standing near the family can close, and that goes stale fast if it is
              buried. Shown to the teacher and to every assistant — no ability check,
              matching the API, which gates on the TENANT instead. Hidden at zero rather
              than kept as a permanent empty row: home shows what needs doing, and the
              Resolution Center keeps the queue itself. */}
          {unconfirmedNumbers > 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/(teacher)/phone-confirmations' as Href)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: colors.surface, borderRadius: radius.xl,
                borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg,
                ...shadows.sm,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.warningLight, justifyContent: 'center', alignItems: 'center' }}>
                <Icon name="phone" size={22} color={colors.warningText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>أرقام تحتاج تأكيد</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
                  {unconfirmedNumbers} رقم لم يُثبت صاحبه ملكيته — راجِعها قبل أن تحتاج التواصل
                </Text>
              </View>
              <View style={{ minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, backgroundColor: colors.warning, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{unconfirmedNumbers}</Text>
              </View>
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
          {/* Fast student recording — name + parent phone, activate later. Same ability as
              enroll, and behind the super-admin's fast_register switch: off hides it here
              and the API refuses it, so an old build cannot record either. */}
          {can(ABILITY.MANAGE_STUDENTS) && flags?.fast_register ? (
            <TouchableOpacity
              onPress={() => router.push('/(teacher)/record-student' as Href)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: colors.surface, borderRadius: radius.xl,
                borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg,
              }}
            >
              <Icon name="add" size={24} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>تسجيل سريع للطلاب</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>أضِف الطلاب بالاسم ورقم ولي الأمر — يُفعّلون حساباتهم لاحقًا</Text>
              </View>
              <Icon name="back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {/* Collection is shown to an assistant exactly as to the teacher (founder
              2026-09-05): it is usually the assistant standing at the door taking the
              money. No client-side ability check — the API is the gate (it requires
              scan_attendance), so this cannot be the thing that silently hides the
              screen from someone who is allowed to use it. They can collect but never
              waive or reverse, see only their own venues, and every collection they
              make goes to the teacher's oversight list. */}
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
