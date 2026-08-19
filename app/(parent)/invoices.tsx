import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { formatDate, daysUntil } from '@/utils/format';
import { formatEGP } from '@/utils/currency';
import { useInvoices, useParentPendingDues } from '@/hooks/useInvoices';
import type { Invoice, PendingDue } from '@/api/invoices';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { PaymentSection } from '@/components/parent/PaymentSection';
import { PendingDueCard } from '@/components/parent/PendingDueCard';

const statusConfig: Record<string, { color: string }> = {
  paid: { color: colors.success },
  pending: { color: colors.warning },
  overdue: { color: colors.danger },
};

export default function InvoicesPage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: invoices, isLoading, isError, refetch } = useInvoices();
  const { data: dues, refetch: refetchDues } = useParentPendingDues();
  const { refreshing, onRefresh } = usePullRefresh(refetch, refetchDues);

  const totalDue = (invoices ?? []).filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const paidAmount = (invoices ?? []).filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const overdueCount = (invoices ?? []).filter((i) => i.status === 'overdue').length;

  // Each teacher bills independently, so the parent's dues + invoices are grouped
  // per teacher — one section per teacher, never one mixed pile. Items without a
  // teacher fall under a neutral "أخرى" bucket.
  const groups = useMemo(() => {
    const map = new Map<string, { teacher: string; dues: PendingDue[]; invoices: Invoice[] }>();
    const keyOf = (name?: string | null) => (name && name.trim()) || 'أخرى';
    const bucket = (name?: string | null) => {
      const k = keyOf(name);
      let g = map.get(k);
      if (!g) { g = { teacher: k, dues: [], invoices: [] }; map.set(k, g); }
      return g;
    };
    for (const d of dues ?? []) bucket(d.teacher_name).dues.push(d);
    for (const inv of invoices ?? []) bucket(inv.teacher_name).invoices.push(inv);
    return Array.from(map.values());
  }, [dues, invoices]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

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
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: '#fff', letterSpacing: -0.5 }}>
            {t('invoices.title')}
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: 'rgba(255,255,255,0.72)', marginTop: spacing.xs }}>
            {formatDate(new Date())}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{formatEGP(totalDue)}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{t('invoices.total_due')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{formatEGP(paidAmount)}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{t('invoices.paid_amount')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{overdueCount}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{t('invoices.overdue')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          {groups.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, ...shadows.sm }}>
              <EmptyState icon="invoices" title={t('invoices.no_invoices')} />
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.teacher} style={{ gap: spacing.md }}>
                {/* Per-teacher header — each teacher's bills stand on their own. */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
                    <Icon name="teacher" size={18} color={colors.brand} />
                  </View>
                  <Text style={[textPresets.h3, { flex: 1 }]} numberOfLines={1}>{group.teacher}</Text>
                </View>
                {group.dues.map((due) => (
                  <PendingDueCard key={`due-${due.id}`} due={due} showStudent />
                ))}
                {group.invoices.map((invoice) => (
                  <InvoiceCard key={invoice.id} invoice={invoice} />
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const sc = statusConfig[invoice.status] ?? statusConfig.pending;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.xl, ...shadows.sm, borderStartWidth: 4, borderStartColor: sc.color }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={textPresets.subtitle}>{invoice.number}</Text>
            <StatusBadge status={invoice.status} />
          </View>
          {(invoice.items ?? []).map((item, i) => (
            <Text key={i} style={[textPresets.bodySmall, { marginTop: 2 }]}>{item}</Text>
          ))}
          {invoice.student_name ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Icon name="child" size={15} color={colors.textSecondary} outline style={{ marginEnd: 3 }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{invoice.student_name}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md }}>
        <View>
          <Text style={[textPresets.bodySmall]}>
            {t('invoices.due_date')}: {invoice.due_date ? formatDate(new Date(invoice.due_date), { day: 'numeric', month: 'short' }) : '-'}
          </Text>
          {invoice.status !== 'paid' && invoice.due_date ? (() => {
            const days = daysUntil(invoice.due_date);
            const overdue = invoice.status === 'overdue' || days < 0;
            const label = overdue
              ? t('invoices.overdue_since', { count: Math.abs(days) })
              : days === 0 ? t('invoices.due_today') : t('invoices.due_in', { count: days });
            return (
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, marginTop: 2, color: overdue ? colors.danger : colors.warning }}>
                {label}
              </Text>
            );
          })() : null}
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.primary }}>{formatEGP(invoice.amount)}</Text>
      </View>
      <PaymentSection invoice={invoice} />
    </TouchableOpacity>
  );
}
