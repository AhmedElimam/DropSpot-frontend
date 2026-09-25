import { memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { formatNumber } from '@/utils/format';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatsCard } from '@/components/layout/StatsCard';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useReviseMode } from '@/hooks/useReviseMode';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getTeacherInsights } from '@/api/insights';
import { getBookingRequests } from '@/api/bookingRequests';
import { getAssistantActions } from '@/api/assistantActions';
import { getCashReconciliation } from '@/api/cash';

/**
 * "الإدارة" tab — the hub for course & schedule management (the web-dashboard
 * parity surface). Course CREATION stays on the web; here the teacher manages
 * existing courses (settings, GPS location, slots) and runs schedule tools.
 */
// Row and SectionTitle live at MODULE level, not inside the screen. Declared in the
// render body they were a brand-new component *type* on every render, so React could not
// reconcile them: it unmounted and rebuilt all 15 rows and their native views each time
// this screen re-rendered — and this is a TAB, so it stays mounted and re-renders on
// every poll tick and cache update behind the user's back. (Android slowness/heat,
// 2026-09-22.)
const Row = memo(function Row({ icon, title, sub, onPress, tint }: { icon: IconName; title: string; sub: string; onPress: () => void; tint?: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: (tint ?? colors.brand) + '18', justifyContent: 'center', alignItems: 'center' }}>
        <Icon name={icon} size={22} color={tint ?? colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{sub}</Text>
      </View>
      <Icon name="back" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
});

const SectionTitle = memo(function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{children}</Text>
  );
});

export default function TeacherManage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { can, isAssistant } = useActiveAbilities();
  const { data: flags } = useFeatureFlags();
  const { data: reviseOn } = useReviseMode();

  const canCourses = can(ABILITY.MANAGE_COURSES);
  const canSessions = can(ABILITY.MANAGE_SESSIONS);
  const canStudents = can(ABILITY.MANAGE_STUDENTS);
  const canReviewProofs = can(ABILITY.REVIEW_PAYMENT_PROOFS);
  const ramadanOn = !!flags?.ramadan_schedule;
  // Insights are teacher-only (finance/analytics) — never fetched or shown to an
  // assistant (the API rejects them with 403 anyway).
  // The hub block always shows the current month; the full screen is where the period
  // can be changed (its query key carries the range, so the two never collide in cache).
  const insights = useQuery({ queryKey: ['teacher-insights', 'month'], queryFn: () => getTeacherInsights({ range: 'month' }), enabled: !isAssistant });
  const ins = insights.data;
  // Existing-student booking requests awaiting accept/reject (highlighted when any).
  const bookingReqs = useQuery({ queryKey: ['booking-requests'], queryFn: getBookingRequests, enabled: canStudents });
  const pendingReqs = bookingReqs.data?.length ?? 0;
  // Assistant money-action oversight (teacher-only — reviewing the assistant's approvals/collections).
  const assistantActions = useQuery({ queryKey: ['assistant-actions'], queryFn: getAssistantActions, enabled: !isAssistant });
  // Weekly cash count (spec 2026-09-25). For an assistant this is the prompt they must
  // answer on Thursday evening — surfaced as a banner here because a push tap does not
  // deep-link on this layout. Their own figures only; the server decides the shape.
  const canCash = can(ABILITY.SCAN);
  const cash = useQuery({ queryKey: ['cash-reconciliation'], queryFn: () => getCashReconciliation(), enabled: canCash });
  const cashView = cash.data;
  const cashPending = cashView?.role === 'assistant' ? cashView.unanswered[0] ?? null : null;
  const cashOpenGaps = cashView?.role === 'teacher' ? cashView.open_gaps.length + cashView.pending_handovers.length : 0;
  const expensesOn = cashView?.settings.expenses_enabled !== false;

  // Every figure on this hub is a cached count; a pull must refresh all of them, not
  // whichever one happens to be stalest.
  const { refreshing, onRefresh } = usePullRefresh(
    insights.refetch, bookingReqs.refetch, assistantActions.refetch, cash.refetch,
  );
  const pendingActions = assistantActions.data?.length ?? 0;
  const money = (v: number) => `${Math.round(v).toLocaleString('en-US')} ${t('insights.egp')}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary }}>{t('teacher.tab_manage')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Mini insights — teacher-only (hidden from assistants). */}
        {!isAssistant ? (
        <>
        <SectionTitle>{t('teacher.insights_title')}</SectionTitle>
        {ins ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(teacher)/insights' as Href)}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              <StatsCard label={t('insights.attendance_rate')} value={`${ins.attendance.rate}%`} color={colors.success} bgColor={colors.success + '18'} />
              <StatsCard label={t('insights.at_risk')} value={ins.absence.at_risk} color={colors.warning} bgColor={colors.warning + '18'} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              <StatsCard label={t('insights.collected_month')} value={money(ins.financial.collected_this_month)} />
              <StatsCard label={t('insights.new_students')} value={ins.growth.new_students} color={colors.brand} bgColor={colors.brand + '18'} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.view_all_insights')}</Text>
              <Icon name="back" size={16} color={colors.brand} />
            </View>
          </TouchableOpacity>
        ) : (
          <Row icon="reports" title={t('teacher.insights_title')} sub={t('teacher.insights_sub')} onPress={() => router.push('/(teacher)/insights' as Href)} />
        )}
        </>
        ) : null}

        {/* Payments — proof review (teacher, or assistant granted the ability) +
            billing settings (teacher-only). Section hidden entirely if neither applies. */}
        {canReviewProofs || !isAssistant ? (
          <>
            <SectionTitle>{t('teacher.payments_title')}</SectionTitle>
            {canReviewProofs ? (
              <Row icon="money" title={t('payment_proofs.title')} sub={t('payment_proofs.manage_sub')} tint={colors.success} onPress={() => router.push('/(teacher)/payment-proofs' as Href)} />
            ) : null}
            {!isAssistant ? (
              <Row icon="card" title={t('billing_settings.title')} sub={t('billing_settings.manage_sub')} onPress={() => router.push('/(teacher)/billing-settings' as Href)} />
            ) : null}
            {!isAssistant ? (
              <TouchableOpacity
                onPress={() => router.push('/(teacher)/assistant-actions' as Href)}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: pendingActions > 0 ? '#FEF3E2' : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: pendingActions > 0 ? colors.warning : colors.border, padding: spacing.lg, marginBottom: spacing.sm }}
              >
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.warning + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="eye" size={22} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('assistant_actions.title')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('assistant_actions.manage_sub')}</Text>
                </View>
                {pendingActions > 0 ? (
                  <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{pendingActions}</Text>
                  </View>
                ) : (
                  <Icon name="back" size={18} color={colors.textTertiary} />
                )}
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        {/* Cash reconciliation + expenses — teacher, or an assistant who handles cash
            (same gate as collecting). An unanswered Thursday count is the loudest thing
            on this hub for an assistant; open gaps are for the teacher. */}
        {canCash ? (
          <>
            <SectionTitle>{t('teacher.cash_section_title')}</SectionTitle>
            {cashPending ? (
              <TouchableOpacity
                onPress={() => router.push('/(teacher)/cash-reconcile' as Href)}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#FEF3E2', borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.warning, padding: spacing.lg, marginBottom: spacing.sm }}
              >
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.warning + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="money" size={22} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.banner_pending')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('cash.banner_pending_sub', { amount: formatNumber(cashPending.collected, { maximumFractionDigits: 0 }) })}</Text>
                </View>
                <Icon name="back" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => router.push('/(teacher)/cash-reconcile' as Href)}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: cashOpenGaps > 0 ? '#FEF3E2' : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: cashOpenGaps > 0 ? colors.warning : colors.border, padding: spacing.lg, marginBottom: spacing.sm }}
              >
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.success + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="money" size={22} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('cash.title')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{isAssistant ? t('cash.manage_sub_assistant') : t('cash.manage_sub')}</Text>
                </View>
                {cashOpenGaps > 0 ? (
                  <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{cashOpenGaps}</Text>
                  </View>
                ) : (
                  <Icon name="back" size={18} color={colors.textTertiary} />
                )}
              </TouchableOpacity>
            )}
            {expensesOn ? (
              <Row icon="note" title={t('expenses.title')} sub={t('expenses.manage_sub')} tint={colors.success} onPress={() => router.push('/(teacher)/expenses' as Href)} />
            ) : null}
          </>
        ) : null}

        <SectionTitle>{t('teacher.resolution_title')}</SectionTitle>
        <Row icon="bell" title={t('teacher.resolution_title')} sub={t('teacher.resolution_sub')} tint={colors.warning} onPress={() => router.push('/(teacher)/resolution' as Href)} />

        {/* Special / exam sessions — NORMAL mode: create a one-off exam session on
            any weekly slot, then mark attendance + enter exam grades. Always on. */}
        <Row icon="reports" title={t('teacher.special_sessions_title')} sub={t('teacher.special_sessions_sub')} tint={colors.brand} onPress={() => router.push('/(teacher)/exam-create' as Href)} />

        {/* Revision engine — gated on the SUPER-ADMIN feature flag first (fails safe to
            hidden until an admin enables it), then the teacher's own show/hide switch. */}
        {flags?.revise_mode && reviseOn !== false ? (
          <Row icon="book" title={t('teacher.revision_mode_row')} sub={t('teacher.revision_mode_row_sub')} tint={colors.brand} onPress={() => router.push('/(teacher)/revisions' as Href)} />
        ) : null}

        <SectionTitle>{t('teacher.courses_title')}</SectionTitle>
        <Row icon="book" title={t('teacher.courses_title')} sub={t('teacher.courses_manage_hint')} onPress={() => router.push('/(teacher)/courses' as Href)} />
        {canCourses ? (
          <Row icon="add" title={t('teacher.create_course')} sub={t('teacher.create_course_sub')} onPress={() => router.push('/(teacher)/courses/create' as Href)} />
        ) : null}
        {canStudents ? (
          <Row icon="phone" title={t('invite_phone.title')} sub={t('invite_phone.manage_sub')} tint={colors.brand} onPress={() => router.push('/(teacher)/invite-phone' as Href)} />
        ) : null}
        {canStudents ? (
          <Row icon="send" title={t('invite_link.title')} sub={t('invite_link.manage_sub')} tint={colors.brand} onPress={() => router.push('/(teacher)/invite-link' as Href)} />
        ) : null}
        {canStudents ? (
          <TouchableOpacity
            onPress={() => router.push('/(teacher)/booking-requests' as Href)}
            activeOpacity={0.8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: pendingReqs > 0 ? ('#FEF3E2') : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: pendingReqs > 0 ? colors.warning : colors.border, padding: spacing.lg, marginBottom: spacing.sm }}
          >
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.warning + '18', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="bell" size={22} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('booking_requests.title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('booking_requests.manage_sub')}</Text>
            </View>
            {pendingReqs > 0 ? (
              <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{pendingReqs}</Text>
              </View>
            ) : (
              <Icon name="back" size={18} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
        ) : null}
        {canStudents ? (
          <Row icon="card" title={t('card_order_link.title')} sub={t('card_order_link.manage_sub')} tint={colors.brand} onPress={() => router.push('/(teacher)/card-order-link' as Href)} />
        ) : null}

        {canSessions || canCourses ? (
          <>
            <SectionTitle>{t('teacher.schedule_tools')}</SectionTitle>
            {/* «إضافة جدول» removed from the hub — add/remove weekly slots from the
                course's own Edit page (which routes to schedule-new). Avoids a redundant
                second scheduling surface next to Create/Edit Course. */}
            {canSessions ? (
              <Row icon="clock" title={t('teacher.pause_period')} sub={t('teacher.pause_sub')} tint={colors.warning} onPress={() => router.push('/(teacher)/pause' as Href)} />
            ) : null}
            {canCourses ? (
              <Row icon="gps" title="أماكن التدريس" sub="أماكنك ومساعدو كل مكان — تُربط بالمقررات اختياريًا" onPress={() => router.push('/(teacher)/venues' as Href)} />
            ) : null}
            {canCourses ? (
              <Row icon="calendar" title={t('teacher.merge_title')} sub={t('teacher.merge_sub')} onPress={() => router.push('/(teacher)/schedule-merge' as Href)} />
            ) : null}
            {canCourses && ramadanOn ? (
              <Row icon="clock" title={t('teacher.overrides_title')} sub={t('teacher.overrides_sub')} tint={colors.info} onPress={() => router.push('/(teacher)/schedule-overrides' as Href)} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
