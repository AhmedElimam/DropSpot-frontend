import { memo, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/layout/Avatar';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { useBillingOverrides, useCheckinPermissions, useRevokeBillingOverride, useRevokeCheckinPermission } from '@/hooks/useOverrides';
import { formatNumber, formatDate } from '@/utils/format';
import type { BillingOverride, CheckinPermission } from '@/api/teacher';

type Segment = 'billing' | 'phone';

/** Whole days until `iso` (0 = today, negative = past). */
function daysLeft(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startOfEnd = new Date(end); startOfEnd.setHours(0, 0, 0, 0);
  return Math.round((startOfEnd.getTime() - startOfToday.getTime()) / 86_400_000);
}

// How long an exception has left decides its colour: comfortable, closing in, about to end.
function urgency(days: number | null): { color: string; bg: string } {
  if (days === null || days > 7) return { color: colors.success, bg: colors.successLight };
  if (days > 2) return { color: colors.warning, bg: colors.warningLight };
  return { color: colors.danger, bg: colors.dangerLight };
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return formatDate(iso, { weekday: undefined, month: 'short' }); } catch { return '—'; }
}

type RowData = {
  key: string;
  id: number;
  studentId: number | null;
  name: string | null;
  detail: string | null;
  grantedBy: string | null;
  expiresAt: string | null;
};

/** One exception, in the session sheet's row style: stripe, avatar, who, why, and when it ends. */
const ExceptionRow = memo(function ExceptionRow({ r, now, canRevoke, revoking, onRevoke, onOpen }: {
  r: RowData; now: number; canRevoke: boolean; revoking: boolean; onRevoke: (r: RowData) => void; onOpen: (r: RowData) => void;
}) {
  const { t } = useTranslation();
  const days = daysLeft(r.expiresAt, now);
  const u = urgency(days);
  const when = days === null ? fmtDate(r.expiresAt)
    : days < 0 ? t('exceptions_ui.expired')
    : days === 0 ? t('exceptions_ui.ends_today')
    : days === 1 ? t('exceptions_ui.ends_tomorrow')
    : days === 2 ? t('exceptions_ui.ends_two_days')
    : days <= 10 ? t('exceptions_ui.ends_few_days', { n: formatNumber(days) })
    : t('exceptions_ui.ends_many_days', { n: formatNumber(days) });
  return (
    <TouchableOpacity onPress={() => onOpen(r)} activeOpacity={0.85} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: u.color, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm, minHeight: 66 }}>
      <Avatar name={r.name ?? '—'} seed={avatarSeed.student(r.studentId, r.name ?? '—')} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{r.name ?? '—'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
          <View style={{ backgroundColor: u.bg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: u.color }}>{when}</Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{`${t('teacher.until')} ${fmtDate(r.expiresAt)}`}</Text>
        </View>
        {r.detail || r.grantedBy ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 3 }} numberOfLines={1}>
            {[r.detail, r.grantedBy ? t('exceptions_ui.granted_by', { name: r.grantedBy }) : null].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      {canRevoke ? (
        <TouchableOpacity onPress={() => onRevoke(r)} disabled={revoking} hitSlop={4} accessibilityRole="button" accessibilityLabel={t('teacher.revoke')}
          style={{ width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.danger + '14', borderWidth: 1, borderColor: colors.danger + '55' }}>
          {revoking ? <ActivityIndicator size="small" color={colors.danger} /> : <Icon name="close" size={20} color={colors.danger} />}
        </TouchableOpacity>
      ) : (
        <Icon name="back" size={16} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
});

/**
 * «الاستثناءات» — the 15-day billing exceptions and the phone check-in permissions a
 * teacher has open, in the compact ink-header style of the other hubs: one title line
 * with the total and «منح استثناء», a two-pill switch between the two kinds, and rows
 * coloured by how long each has left. A teacher revokes from the row (with a confirm);
 * an assistant granted scan_attendance may GRANT a billing exception (the teacher is
 * notified server-side) but never revokes — the server enforces both regardless.
 */
export default function OverridesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const now = useMinuteClock();
  const { can, isAssistant } = useActiveAbilities();
  const canGrant = can(ABILITY.SCAN);
  const canRevoke = !isAssistant;

  const overrides = useBillingOverrides();
  const permissions = useCheckinPermissions();
  const revokeOverride = useRevokeBillingOverride();
  const revokePermission = useRevokeCheckinPermission();
  const { refreshing, onRefresh } = usePullRefresh(overrides.refetch, permissions.refetch);
  const [segment, setSegment] = useState<Segment>('billing');

  const billingRows = useMemo<RowData[]>(() => (overrides.data ?? []).map((o: BillingOverride) => ({
    key: `o${o.id}`, id: o.id, studentId: o.student_id ?? null, name: o.student_name, detail: o.reason, grantedBy: o.granted_by_name, expiresAt: o.expires_at,
  })), [overrides.data]);
  const phoneRows = useMemo<RowData[]>(() => (permissions.data ?? []).map((p: CheckinPermission) => ({
    key: `p${p.id}`, id: p.id, studentId: p.student_id ?? null, name: p.student_name, detail: [p.course_name, p.note].filter(Boolean).join(' · ') || null, grantedBy: p.granted_by_name, expiresAt: p.expires_at,
  })), [permissions.data]);
  const rows = segment === 'billing' ? billingRows : phoneRows;
  const loading = segment === 'billing' ? overrides.isLoading : permissions.isLoading;
  const total = billingRows.length + phoneRows.length;

  const revoke = (r: RowData) => {
    const billing = segment === 'billing';
    Alert.alert(t('exceptions_ui.revoke_title'), t(billing ? 'exceptions_ui.revoke_body_billing' : 'exceptions_ui.revoke_body_phone', { name: r.name ?? '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('teacher.revoke'), style: 'destructive',
        onPress: () => (billing ? revokeOverride : revokePermission).mutate(r.id, {
          onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.error')),
        }),
      },
    ]);
  };
  const open = (r: RowData) => {
    const src = segment === 'billing' ? overrides.data?.find((o) => o.id === r.id)?.student_id : permissions.data?.find((p) => p.id === r.id)?.student_id;
    if (src) router.push(`/(teacher)/students/${src}` as Href);
  };
  const revokingId = segment === 'billing'
    ? (revokeOverride.isPending ? revokeOverride.variables : null)
    : (revokePermission.isPending ? revokePermission.variables : null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.onHeroChip, justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="forward" size={20} color={colors.onHero} />
          </TouchableOpacity>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.onHero }}>{t('teacher.overrides')}</Text>
          <View style={{ backgroundColor: colors.onHeroChip, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onHero }}>{formatNumber(total)}</Text>
          </View>
          <View style={{ flex: 1 }} />
          {canGrant ? (
            <TouchableOpacity onPress={() => router.push('/(teacher)/grant-exception' as Href)} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.accent }}>
              <Icon name="add" size={18} color={colors.onAccent} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onAccent }}>{t('teacher.grant_override')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md }}>
          {([['billing', 'money', t('teacher.billing_overrides'), billingRows.length], ['phone', 'phone', t('teacher.phone_permissions'), phoneRows.length]] as const).map(([k, icon, label, n]) => {
            const on = segment === k;
            return (
              <TouchableOpacity key={k} onPress={() => setSegment(k)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ flex: 1, height: 40, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: on ? colors.heroChipActive : colors.onHeroChip, borderWidth: 1, borderColor: on ? colors.heroChipActive : colors.onHeroChipBorder }}>
                <Icon name={icon} size={15} color={on ? colors.brand : colors.onHero} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.onHeroChipActive : colors.onHero }} numberOfLines={1}>{label}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.brand : colors.onHeroSoft }}>{formatNumber(n)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={({ item }) => (
            <ExceptionRow r={item} now={now} canRevoke={canRevoke} revoking={revokingId === item.id} onRevoke={revoke} onOpen={open} />
          )}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          removeClippedSubviews initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7}
          ListHeaderComponent={
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.md }}>
              {isAssistant
                ? t(canGrant ? 'teacher.assistant_can_grant_override_note' : 'teacher.assistant_override_note')
                : t(segment === 'billing' ? 'exceptions_ui.billing_intro' : 'exceptions_ui.phone_intro')}
            </Text>
          }
          ListEmptyComponent={
            <EmptyState icon={segment === 'billing' ? 'money' : 'phone'}
              title={t(segment === 'billing' ? 'teacher.no_overrides' : 'teacher.no_permissions')}
              message={t(segment === 'billing' ? 'exceptions_ui.billing_empty_hint' : 'exceptions_ui.phone_empty_hint')} />
          }
        />
      )}
    </View>
  );
}
