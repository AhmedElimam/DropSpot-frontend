import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRose } from '@/hooks/useRose';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '@/theme/typography';
import { formatNumber } from '@/utils/format';
import { colors, spacing, radius, nav, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
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
// Each group has its own colour, carried by its tile and every row inside it.
const GROUP_LOOK = (): Record<Group, { icon: IconName; tint: string }> => ({
  students: { icon: 'children', tint: colors.brand },
  schedule: { icon: 'calendar', tint: colors.accent },
  money: { icon: 'money', tint: colors.success },
  followup: { icon: 'bell', tint: colors.warning },
});

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
  const rose = useRose();
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

  const totalAttention = visible.reduce((n, g) => n + counts[g], 0);
  const tint = GROUP_LOOK()[group].tint;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        {/* Compact header, as on Students: title + what waits on one line, the groups as one
            row of pills underneath. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.onHero }}>{t('teacher.tab_manage')}</Text>
          <View style={{ flexShrink: 1, height: 26, paddingHorizontal: 10, borderRadius: radius.full, justifyContent: 'center', backgroundColor: totalAttention > 0 ? colors.accent : colors.onHeroChip }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: totalAttention > 0 ? colors.onAccent : colors.onHeroSoft }} numberOfLines={1}>
              {totalAttention > 0 ? t('manage.waiting_summary', { n: formatNumber(totalAttention) }) : t('manage.all_clear')}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md }}>
          {visible.map((g) => {
            const on = group === g;
            const n = counts[g];
            const look = GROUP_LOOK()[g];
            return (
              <TouchableOpacity key={g} onPress={() => pick(g)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radius.md, backgroundColor: on ? look.tint : colors.onHeroChip, borderWidth: 1, borderColor: on ? look.tint : colors.onHeroChip }}>
                <Icon name={look.icon} size={15} color={on ? colors.onPrimary : colors.onHero} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.onPrimary : colors.onHero }} numberOfLines={1}>{t(`manage.group_${g}`)}</Text>
                {n > 0 ? (
                  // Pinned to the corner, so four pills still fit a narrow phone.
                  <View style={{ position: 'absolute', top: -6, end: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: gradients.hero[1], alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.onAccent }}>{formatNumber(n)}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs }}>
        <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: tint }} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t(`manage.group_${group}`)}</Text>
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>{t(`manage.group_${group}_sub`)}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {group === 'students' ? (
          <>
            {canStudents ? <HubRow tint={tint} icon="add" title={t('add_student.title')} sub={t('add_student.subtitle')} onPress={() => setAddOpen(true)} /> : null}
            {canStudents ? <HubRow tint={tint} icon="bell" title={t('booking_requests.title')} sub={t('booking_requests.manage_sub')} badge={pendingReqs} onPress={() => router.push('/(teacher)/booking-requests' as Href)} /> : null}
            <HubRow tint={tint} icon="phone" title={t('home.phones_title')} sub={t('manage.phones_sub')} badge={phoneCount} onPress={() => router.push('/(teacher)/phone-confirmations' as Href)} />
            {canStudents ? <HubRow tint={tint} icon="card" title={t('manage.cards_title')} sub={t('manage.cards_sub')} onPress={() => router.push('/(teacher)/students?segment=cards' as Href)} /> : null}
            {canStudents ? <HubRow tint={tint} icon="send" title={t('card_order_link.title')} sub={t('card_order_link.manage_sub')} onPress={() => router.push('/(teacher)/card-order-link' as Href)} /> : null}
            {canCash ? <HubRow tint={tint} icon="lock" title={t('teacher.overrides')} sub={t('manage.overrides_sub')} onPress={() => router.push('/(teacher)/overrides' as Href)} /> : null}
          </>
        ) : null}

        {group === 'schedule' ? (
          <>
            <HubRow tint={tint} icon="book" title={t('teacher.courses_title')} sub={t('manage.courses_sub')} onPress={() => router.push('/(teacher)/courses' as Href)} />
            {!isAssistant ? <HubRow tint={tint} icon="gps" title={t('manage.venues_title')} sub={t('manage.venues_sub')} onPress={() => router.push('/(teacher)/venues' as Href)} /> : null}
            {canSessions ? <HubRow tint={tint} icon="reports" title={t('teacher.special_sessions_title')} sub={t('teacher.special_sessions_sub')} onPress={() => router.push('/(teacher)/exam-create' as Href)} /> : null}
            {!isAssistant && flags?.revise_mode && reviseOn !== false ? <HubRow tint={tint} icon="book" title={t('teacher.revision_mode_row')} sub={t('teacher.revision_mode_row_sub')} onPress={() => router.push('/(teacher)/revisions' as Href)} /> : null}
            {canSessions ? <HubRow tint={tint} icon="clock" title={t('teacher.pause_period')} sub={t('teacher.pause_sub')} onPress={() => router.push('/(teacher)/pause' as Href)} /> : null}
            {canCourses ? <HubRow tint={tint} icon="calendar" title={t('teacher.merge_title')} sub={t('teacher.merge_sub')} onPress={() => router.push('/(teacher)/schedule-merge' as Href)} /> : null}
            {canCourses && ramadanOn ? <HubRow tint={tint} icon="clock" title={t('teacher.overrides_title')} sub={t('teacher.overrides_sub')} onPress={() => router.push('/(teacher)/schedule-overrides' as Href)} /> : null}
          </>
        ) : null}

        {group === 'money' ? (
          <>
            {!isAssistant && ins ? (
              <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/(teacher)/insights' as Href)} style={{ marginBottom: spacing.md }} accessibilityRole="button">
                <LinearGradient colors={gradients.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: spacing.lg }}>
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{t('insights.collected_month')}</Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{money(ins.financial.collected_this_month)}</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{t('insights.outstanding_now')}</Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{money(ins.financial.outstanding)}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('teacher.view_all_insights')}</Text>
                    <Icon name="back" size={16} color="#fff" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ) : !isAssistant ? (
              <HubRow tint={tint} icon="reports" title={t('teacher.insights_title')} sub={t('teacher.insights_sub')} onPress={() => router.push('/(teacher)/insights' as Href)} />
            ) : null}
            {canCash ? (
              <HubRow tint={tint} icon="note" title={cashPending ? t('cash.banner_pending', { rose: rose.name }) : rose.title}
                sub={cashPending ? t('cash.banner_pending_sub', { amount: formatNumber(cashPending.collected, { maximumFractionDigits: 0 }) }) : isAssistant ? t('cash.manage_sub_assistant') : t('cash.manage_sub')}
                badge={cashAttention} loud={!!cashPending} onPress={() => router.push('/(teacher)/cash-reconcile' as Href)} />
            ) : null}
            {canCash ? <HubRow tint={tint} icon="money" title={t('manage.pending_collections')} sub={t('manage.pending_collections_sub')} onPress={() => router.push('/(teacher)/pending-collections' as Href)} /> : null}
            {canCash && expensesOn ? <HubRow tint={tint} icon="note" title={t('expenses.title')} sub={t('expenses.manage_sub')} onPress={() => router.push('/(teacher)/expenses' as Href)} /> : null}
            {canReviewProofs ? <HubRow tint={tint} icon="card" title={t('payment_proofs.title')} sub={t('payment_proofs.manage_sub')} onPress={() => router.push('/(teacher)/payment-proofs' as Href)} /> : null}
            {!isAssistant ? <HubRow tint={tint} icon="eye" title={t('assistant_actions.title')} sub={t('assistant_actions.manage_sub')} badge={pendingActions} onPress={() => router.push('/(teacher)/assistant-actions' as Href)} /> : null}
            {!isAssistant ? <HubRow tint={tint} icon="settings" title={t('billing_settings.title')} sub={t('billing_settings.manage_sub')} onPress={() => router.push('/(teacher)/billing-settings' as Href)} /> : null}
          </>
        ) : null}

        {group === 'followup' ? (
          <>
            <HubRow tint={tint} icon="bell" title={t('teacher.resolution_title')} sub={t('teacher.resolution_sub')} onPress={() => router.push('/(teacher)/resolution' as Href)} />
            <HubRow tint={tint} icon="tickets" title={t('teacher.tab_tickets')} sub={t('manage.tickets_sub')} badge={openTickets} onPress={() => router.push('/(teacher)/tickets' as Href)} />
            <HubRow tint={tint} icon="bell" title={t('manage.notifications_title')} sub={t('manage.notifications_sub')} onPress={() => router.push('/(teacher)/notifications' as Href)} />
            {!isAssistant ? <HubRow tint={tint} icon="children" title={t('assistants.title')} sub={t('assistants.subtitle')} onPress={() => router.push('/(teacher)/assistants' as Href)} /> : null}
          </>
        ) : null}
      </ScrollView>
      <AddStudentSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}
