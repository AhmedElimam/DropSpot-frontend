import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useChildren } from '@/hooks/useChildren';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import type { Child } from '@/api/children';
import { useNotifications, useUnreadCount } from '@/hooks/useNotifications';
import { WhatsNewCard } from '@/components/WhatsNewCard';
import { useParentAttendanceRisk } from '@/hooks/useAttendance';
import { useParentBillingStatus } from '@/hooks/useInvoices';
import { AttendanceRiskCard } from '@/components/attendance/AttendanceRiskCard';
import { BillingOverdueCard } from '@/components/attendance/BillingOverdueCard';
import { CardOrderBanner } from '@/components/cardOrder/CardOrderBanner';
import { usePendingPrecardInvites, useAcceptPrecardInvite, useRejectPrecardInvite } from '@/hooks/usePrecardPhone';
import { usePendingSiblingClaims, useConfirmSiblingClaim, useDenySiblingClaim } from '@/hooks/useSiblingClaims';
import { Avatar } from '@/components/layout/Avatar';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { HeaderBrandBar } from '@/components/ui/HeaderBrandBar';
import { SectionHead } from '@/components/ui/SectionHead';
import { ActionTile } from '@/components/ui/ShortcutTile';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { timeAgo, formatNumber } from '@/utils/format';

/**
 * Parent Home — "Sanad" simple mode, built for an older parent (founder 2026-10-03: «some
 * love on the parent side»). One job: understand each child at a glance, then reach the few
 * things that matter with big, word-labelled actions. No raw percentages, no dense grids.
 *
 * The hero carries the household in two numbers (children · those doing well) and the
 * one-line verdict; each child is a card with a coloured standing pill; the four actions
 * are big two-per-row tiles with a colour each, sized for a thumb.
 *
 * A child's line is a PLAIN-LANGUAGE standing derived from real attendance_rate
 * (no fabricated "today" status — that would need a dedicated endpoint).
 */

const notifIcon: Record<string, IconName> = {
  attendance: 'attendance', absence: 'warning', left_early: 'clock', grade: 'grades',
  invoice: 'invoices', invoice_new: 'invoices', invoice_overdue: 'money',
  session_swap: 'calendar', enrollment_transfer: 'calendar', schedule: 'calendar',
  student_report: 'note', monthly_report: 'reports', daily_digest: 'bell',
};

type Standing = { key: string; color: string; tint: string };
function standingFor(rate: number): Standing {
  if (rate >= 90) return { key: 'home.standing_excellent', color: colors.successText, tint: colors.successLight };
  if (rate >= 75) return { key: 'home.standing_good', color: colors.infoText, tint: colors.infoLight };
  return { key: 'home.standing_watch', color: colors.warningText, tint: colors.warningLight };
}

export default function ParentHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: children, isLoading: childrenLoading, refetch: refetchChildren } = useChildren();
  const { data: notifications, refetch: refetchNotifications } = useNotifications();
  const { data: unread } = useUnreadCount();
  const { data: risks, refetch: refetchRisks } = useParentAttendanceRisk();
  const { data: billingAlerts, refetch: refetchBilling } = useParentBillingStatus();
  const { refreshing, onRefresh } = usePullRefresh(refetchChildren, refetchNotifications, refetchRisks, refetchBilling);

  const kids = children ?? [];
  const latest = (notifications ?? [])[0];
  const well = kids.filter((c) => (c.attendance_rate ?? 0) >= 75).length;
  const allWell = kids.length > 0 && well === kids.length;
  const attention = (billingAlerts?.length ?? 0) + (risks?.length ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl + insets.top, paddingBottom: spacing.xl4 + spacing.lg }}
        >
          <HeaderBrandBar onBell={() => router.push('/(parent)/notifications')} unread={unread} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.onHeroSoft }}>{t('home.welcome')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.onHero, marginTop: 2 }} numberOfLines={1}>
            {user?.name || 'ولي الأمر'}
          </Text>

          {kids.length > 0 ? (
            <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm }}>
              {[
                { k: 'kids', v: formatNumber(kids.length), l: t('home.children_section') },
                { k: 'well', v: formatNumber(well), l: t('home.standing_good'), good: true },
                { k: 'attention', v: formatNumber(attention), l: t('home.some_attention_short'), warn: attention > 0 },
              ].map((x) => (
                <View key={x.k} style={{ flex: 1, backgroundColor: colors.onHeroChip, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.onHeroChipBorder, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: x.warn ? colors.accent : colors.onHero }}>{x.v}</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.onHeroSoft }} numberOfLines={1}>{x.l}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4 }}>
          {/* The verdict card: one plain sentence about the household. */}
          {kids.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.md }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: allWell ? colors.successLight : colors.warningLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={allWell ? 'success' : 'warning'} size={26} color={allWell ? colors.success : colors.warningDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t(allWell ? 'home.all_well' : 'home.some_attention')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{t('home.children_hint')}</Text>
              </View>
            </View>
          ) : null}

          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            <CardOrderBanner scope="parent" />
            <WhatsNewCard />
            {/* Overdue billing (may block check-in) then auto-termination risk */}
            {(billingAlerts ?? []).map((alert, i) => (
              <BillingOverdueCard key={`bill-${alert.student_id}-${i}`} alert={alert} showName />
            ))}
            {(risks ?? []).map((risk, i) => (
              <AttendanceRiskCard key={`${risk.student_id}-${risk.course_name ?? i}`} risk={risk} showName />
            ))}
            {/* §3 — pending phone pre-card invitations awaiting the family's consent */}
            <PendingSiblingClaims t={t} />
            <PendingInvites t={t} />
          </View>

          {/* Children */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHead icon="children" color={colors.brand} title={t('home.children_section')} />
            {childrenLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl }} />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {kids.map((child) => <ChildCard key={child.id} child={child} t={t} />)}
              </View>
            )}
          </View>

          {/* Actions — big, coloured, two per row. */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHead icon="star" color={colors.accent} title={t('home.actions_section')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm }}>
              <ActionTile icon="calendar" color={colors.brand} tint={colors.brandTint} title={t('today.title')} subtitle={t('today.subtitle')} onPress={() => router.push('/(parent)/today')} />
              <ActionTile icon="invoices" color={colors.success} tint={colors.successLight} title={t('home.invoices_title')} onPress={() => router.push('/(parent)/invoices')} />
              <ActionTile icon="reports" color={colors.info} tint={colors.infoLight} title={t('reports.report_cards')} subtitle={t('reports.report_cards_sub')} onPress={() => router.push('/(parent)/report-cards')} />
              <ActionTile icon="ticket" color={colors.accentWarm} tint={colors.accentWarmTint} title={t('home.support_title')} subtitle={t('home.support_sub')} onPress={() => router.push('/(parent)/tickets')} />
            </View>
          </View>

          {/* Latest update */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHead icon="bell" color={colors.warningDark} title={t('home.latest_update')} action={t('notifications.view_all')} onAction={() => router.push('/(parent)/notifications')} />
            {latest ? (
              <TouchableOpacity onPress={() => router.push('/(parent)/notifications')} activeOpacity={0.75} style={{ flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, ...shadows.sm, borderStartWidth: 4, borderStartColor: colors.brand }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name={notifIcon[latest.type] || 'bell'} size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{latest.title}</Text>
                  {latest.body ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary, marginTop: 2 }}>{latest.body}</Text>
                  ) : null}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 6 }}>{timeAgo(latest.created_at)}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textTertiary }}>{t('home.no_updates')}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ChildCard({ child, t }: { child: Child; t: (k: string) => string }) {
  const standing = standingFor(child.attendance_rate ?? 0);
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(parent)/child/${child.id}`)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={child.name}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xxl, padding: spacing.lg, ...shadows.sm, borderStartWidth: 4, borderStartColor: standing.color }}
    >
      <Avatar name={child.name} seed={avatarSeed.student(child.student_id, child.name)} size={56} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }} numberOfLines={1}>{child.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 }}>
          <View style={{ backgroundColor: standing.tint, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 10 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 13, color: standing.color }}>{t(standing.key)}</Text>
          </View>
          {child.grade ? (
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, flexShrink: 1 }}>{child.grade}</Text>
          ) : null}
        </View>
      </View>
      <Icon name="back" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

/**
 * The sibling gate. A child was attached to THIS parent's number as their guardian
 * and the parent has to say whether that is really their child.
 *
 * Why it matters: a student's own number is unique, but a parent's number is shared
 * between siblings on purpose — so a student can type a friend's parent's number and
 * land inside a real family. Denying is what closes that: every teacher the student
 * attends is told the guardian number reaches nobody in that child's family.
 *
 * Renders nothing when there is nothing to answer.
 */
function PendingSiblingClaims({ t }: { t: (k: string) => string }) {
  const { data: claims } = usePendingSiblingClaims();
  const confirm = useConfirmSiblingClaim();
  const deny = useDenySiblingClaim();
  const busy = confirm.isPending || deny.isPending;

  if (!claims || claims.length === 0) return null;

  // Denying carries real consequences for the student's teachers, so it is never a
  // single tap — the parent is told exactly what will happen first.
  function askDeny(id: number, name: string) {
    Alert.alert(
      t('sibling_claim.deny_title'),
      `${name}\n\n${t('sibling_claim.deny_body')}`,
      [
        { text: t('sibling_claim.cancel'), style: 'cancel' },
        {
          text: t('sibling_claim.deny_confirm'),
          style: 'destructive',
          onPress: () => deny.mutate({ id }, {
            onSuccess: () => Alert.alert(t('sibling_claim.denied_title'), t('sibling_claim.denied_body')),
            onError: () => Alert.alert(t('sibling_claim.error')),
          }),
        },
      ],
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={sectionLabel()}>{t('sibling_claim.section')}</Text>
      {claims.map((c) => (
        <View key={c.id} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, ...shadows.sm, borderStartWidth: 4, borderStartColor: colors.warning }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.warningLight, justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="profile" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{c.student_name}</Text>
              {c.grade ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>{c.grade}</Text>
              ) : null}
            </View>
          </View>

          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 22 }}>
            {t('sibling_claim.explain')}
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
            <TouchableOpacity
              onPress={() => confirm.mutate(c.id, { onError: () => Alert.alert(t('sibling_claim.error')) })}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{ flex: 1, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('sibling_claim.yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => askDeny(c.id, c.student_name)}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{ flex: 1, minHeight: 46, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.danger, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.danger }}>{t('sibling_claim.no')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

// §3 — phone pre-card invitations awaiting the family's consent. A teacher invited
// an already-registered, card-less student by phone; the family accepts or rejects
// here (no card handoff needed). Renders nothing when there are none.
function PendingInvites({ t }: { t: (k: string) => string }) {
  const { data: invites } = usePendingPrecardInvites();
  const accept = useAcceptPrecardInvite();
  const reject = useRejectPrecardInvite();
  const busy = accept.isPending || reject.isPending;

  if (!invites || invites.length === 0) return null;

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={sectionLabel()}>{t('invites.pending_section')}</Text>
      {invites.map((inv) => (
        <View key={inv.id} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, ...shadows.sm, borderStartWidth: 4, borderStartColor: colors.accentWarm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentWarmTint, justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="profile" size={20} color={colors.accentWarm} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{inv.student_name}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
                {t('invites.from')} {inv.teacher_name}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
            <TouchableOpacity
              onPress={() => accept.mutate(inv.id)}
              disabled={busy}
              activeOpacity={0.8}
              style={{ flex: 1, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('invites.accept')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => reject.mutate(inv.id)}
              disabled={busy}
              activeOpacity={0.8}
              style={{ flex: 1, minHeight: 46, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary }}>{t('invites.reject')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const sectionLabel = () => ({ fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary, marginStart: spacing.xs } as const);
