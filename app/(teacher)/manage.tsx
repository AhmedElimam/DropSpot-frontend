import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '@/theme/typography';
import { formatNumber } from '@/utils/format';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { StatsCard } from '@/components/layout/StatsCard';
import { HubRow } from '@/components/teacher/HubRow';
import { AddStudentSheet } from '@/components/teacher/AddStudentSheet';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useReviseMode } from '@/hooks/useReviseMode';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { usePhoneConfirmations } from '@/hooks/usePhoneConfirmations';
import { useTickets } from '@/hooks/useTickets';
import { getTeacherInsights } from '@/api/insights';
import { getBookingRequests } from '@/api/bookingRequests';
import { getAssistantActions } from '@/api/assistantActions';
import { getCashReconciliation } from '@/api/cash';

type Group = 'students' | 'schedule' | 'money' | 'followup';
const GROUPS: Group[] = ['students', 'schedule', 'money', 'followup'];
const LAST_GROUP_KEY = 'manage_group_v1';

/**
 * «الإدارة» (founder 2026-10-02: "too much … hard to navigate through that mess"). The
 * 19 rows in 6 sections became four groups behind one segmented control — الطلاب ·
 * الجدول · المال · المتابعة — each at most seven rows, each destination listed ONCE. The
 * chips carry the group's attention count so a teacher sees where something waits
 * without opening it. The last group opened is remembered.
 */
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
  const canCash = can(ABILITY.SCAN);
  const ramadanOn = !!flags?.ramadan_schedule;

  const insights = useQuery({ queryKey: ['teacher-insights', 'month'], queryFn: () => getTeacherInsights({ range: 'month' }), enabled: !isAssistant });
  const bookingReqs = useQuery({ queryKey: ['booking-requests'], queryFn: getBookingRequests, enabled: canStudents });
  const assistantActions = useQuery({ queryKey: ['assistant-actions'], queryFn: getAssistantActions, enabled: !isAssistant });
  const cash = useQuery({ queryKey: ['cash-reconciliation'], queryFn: () => getCashReconciliation(), enabled: canCash });
  const phones = usePhoneConfirmations();
  const tickets = useTickets();
  const { refreshing, onRefresh } = usePullRefresh(insights.refetch, bookingReqs.refetch, assistantActions.refetch, cash.refetch, phones.refetch, tickets.refetch);

  const ins = insights.data;
  const pendingReqs = bookingReqs.data?.length ?? 0;
  const pendingActions = assistantActions.data?.length ?? 0;
  const phoneCount = phones.data?.count ?? 0;
  const openTickets = (tickets.data ?? []).filter((x) => x.status === 'open').length;
  const cashView = cash.data;
  const cashPending = cashView?.role === 'assistant' ? cashView.unanswered[0] ?? null : null;
  const cashAttention = cashView?.role === 'assistant' ? cashView.unanswered.length : cashView?.role === 'teacher' ? cashView.open_gaps.length + cashView.pending_handovers.length : 0;
  const expensesOn = cashView?.settings.expenses_enabled !== false;
  const money = (v: number) => `${formatNumber(Math.round(v))} ${t('insights.egp')}`;

  // Which groups this person can use at all — an assistant never sees an empty group.
  const visible = useMemo(() => GROUPS.filter((g) => {
    if (g === 'students') return canStudents || canCash;
    if (g === 'schedule') return true;
    if (g === 'money') return canCash || !isAssistant || canReviewProofs;
    return true;
  }), [canStudents, canCash, isAssistant, canReviewProofs]);

  const [group, setGroup] = useState<Group>('students');
  useEffect(() => {
    AsyncStorage.getItem(LAST_GROUP_KEY).then((v) => { if (v && (GROUPS as string[]).includes(v)) setGroup(v as Group); }).catch(() => {});
  }, []);
  useEffect(() => { if (!visible.includes(group)) setGroup(visible[0] ?? 'schedule'); }, [visible, group]);
  const pick = (g: Group) => { setGroup(g); AsyncStorage.setItem(LAST_GROUP_KEY, g).catch(() => {}); };

  const counts: Record<Group, number> = {
    students: pendingReqs + phoneCount,
    schedule: 0,
    money: cashAttention + pendingActions,
    followup: openTickets,
  };
  const [addOpen, setAddOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary }}>{t('teacher.tab_manage')}</Text>
      </View>

      {/* Segmented control — the whole hub in four words. */}
      <View style={{ flexDirection: 'row', marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: 4, marginBottom: spacing.sm }}>
        {visible.map((g) => {
          const on = group === g;
          const n = counts[g];
          return (
            <TouchableOpacity key={g} onPress={() => pick(g)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={{ flex: 1, minHeight: 40, borderRadius: radius.md, backgroundColor: on ? colors.surface : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.brand : colors.textSecondary }}>{t(`manage.group_${g}`)}</Text>
              {n > 0 ? (
                <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{n}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: nav.bottomHeight + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {group === 'students' ? (
          <>
            {canStudents ? <HubRow icon="add" title={t('add_student.title')} sub={t('add_student.subtitle')} onPress={() => setAddOpen(true)} /> : null}
            {canStudents ? <HubRow icon="bell" title={t('booking_requests.title')} sub={t('booking_requests.manage_sub')} badge={pendingReqs} tint={colors.warning} onPress={() => router.push('/(teacher)/booking-requests' as Href)} /> : null}
            <HubRow icon="phone" title={t('home.phones_title')} sub={t('manage.phones_sub')} badge={phoneCount} tint={colors.warning} onPress={() => router.push('/(teacher)/phone-confirmations' as Href)} />
            {canStudents ? <HubRow icon="card" title={t('manage.cards_title')} sub={t('manage.cards_sub')} onPress={() => router.push('/(teacher)/students?segment=cards' as Href)} /> : null}
            {canStudents ? <HubRow icon="send" title={t('card_order_link.title')} sub={t('card_order_link.manage_sub')} onPress={() => router.push('/(teacher)/card-order-link' as Href)} /> : null}
            {canCash ? <HubRow icon="lock" title={t('teacher.overrides')} sub={t('manage.overrides_sub')} onPress={() => router.push('/(teacher)/overrides' as Href)} /> : null}
          </>
        ) : null}

        {group === 'schedule' ? (
          <>
            <HubRow icon="book" title={t('teacher.courses_title')} sub={t('manage.courses_sub')} onPress={() => router.push('/(teacher)/courses' as Href)} />
            {!isAssistant ? <HubRow icon="gps" title={t('manage.venues_title')} sub={t('manage.venues_sub')} onPress={() => router.push('/(teacher)/venues' as Href)} /> : null}
            {canSessions ? <HubRow icon="reports" title={t('teacher.special_sessions_title')} sub={t('teacher.special_sessions_sub')} onPress={() => router.push('/(teacher)/exam-create' as Href)} /> : null}
            {!isAssistant && flags?.revise_mode && reviseOn !== false ? <HubRow icon="book" title={t('teacher.revision_mode_row')} sub={t('teacher.revision_mode_row_sub')} onPress={() => router.push('/(teacher)/revisions' as Href)} /> : null}
            {canSessions ? <HubRow icon="clock" title={t('teacher.pause_period')} sub={t('teacher.pause_sub')} tint={colors.warning} onPress={() => router.push('/(teacher)/pause' as Href)} /> : null}
            {canCourses ? <HubRow icon="calendar" title={t('teacher.merge_title')} sub={t('teacher.merge_sub')} onPress={() => router.push('/(teacher)/schedule-merge' as Href)} /> : null}
            {canCourses && ramadanOn ? <HubRow icon="clock" title={t('teacher.overrides_title')} sub={t('teacher.overrides_sub')} tint={colors.info} onPress={() => router.push('/(teacher)/schedule-overrides' as Href)} /> : null}
          </>
        ) : null}

        {group === 'money' ? (
          <>
            {!isAssistant && ins ? (
              <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(teacher)/insights' as Href)} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <StatsCard label={t('insights.collected_month')} value={money(ins.financial.collected_this_month)} color={colors.success} bgColor={colors.success + '18'} />
                  <StatsCard label={t('insights.outstanding_now')} value={money(ins.financial.outstanding)} color={colors.warning} bgColor={colors.warning + '18'} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.xs }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.view_all_insights')}</Text>
                  <Icon name="back" size={16} color={colors.brand} />
                </View>
              </TouchableOpacity>
            ) : !isAssistant ? (
              <HubRow icon="reports" title={t('teacher.insights_title')} sub={t('teacher.insights_sub')} onPress={() => router.push('/(teacher)/insights' as Href)} />
            ) : null}
            {canCash ? (
              <HubRow icon="note" title={cashPending ? t('cash.banner_pending') : t('cash.title')}
                sub={cashPending ? t('cash.banner_pending_sub', { amount: formatNumber(cashPending.collected, { maximumFractionDigits: 0 }) }) : isAssistant ? t('cash.manage_sub_assistant') : t('cash.manage_sub')}
                badge={cashAttention} loud={!!cashPending} tint={colors.success} onPress={() => router.push('/(teacher)/cash-reconcile' as Href)} />
            ) : null}
            {canCash ? <HubRow icon="money" title={t('manage.pending_collections')} sub={t('manage.pending_collections_sub')} tint={colors.success} onPress={() => router.push('/(teacher)/pending-collections' as Href)} /> : null}
            {canCash && expensesOn ? <HubRow icon="note" title={t('expenses.title')} sub={t('expenses.manage_sub')} tint={colors.success} onPress={() => router.push('/(teacher)/expenses' as Href)} /> : null}
            {canReviewProofs ? <HubRow icon="card" title={t('payment_proofs.title')} sub={t('payment_proofs.manage_sub')} tint={colors.success} onPress={() => router.push('/(teacher)/payment-proofs' as Href)} /> : null}
            {!isAssistant ? <HubRow icon="eye" title={t('assistant_actions.title')} sub={t('assistant_actions.manage_sub')} badge={pendingActions} tint={colors.warning} onPress={() => router.push('/(teacher)/assistant-actions' as Href)} /> : null}
            {!isAssistant ? <HubRow icon="settings" title={t('billing_settings.title')} sub={t('billing_settings.manage_sub')} onPress={() => router.push('/(teacher)/billing-settings' as Href)} /> : null}
          </>
        ) : null}

        {group === 'followup' ? (
          <>
            <HubRow icon="bell" title={t('teacher.resolution_title')} sub={t('teacher.resolution_sub')} tint={colors.warning} onPress={() => router.push('/(teacher)/resolution' as Href)} />
            <HubRow icon="tickets" title={t('teacher.tab_tickets')} sub={t('manage.tickets_sub')} badge={openTickets} tint={colors.warning} onPress={() => router.push('/(teacher)/tickets' as Href)} />
            <HubRow icon="bell" title={t('nav.notifications')} sub={t('manage.notifications_sub')} onPress={() => router.push('/(teacher)/notifications' as Href)} />
            {!isAssistant ? <HubRow icon="children" title={t('assistants.title')} sub={t('assistants.subtitle')} onPress={() => router.push('/(teacher)/assistants' as Href)} /> : null}
          </>
        ) : null}
      </ScrollView>
      <AddStudentSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}
