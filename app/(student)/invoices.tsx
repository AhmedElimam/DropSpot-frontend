import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { formatDate, daysUntil } from '@/utils/format';
import { formatEGP } from '@/utils/currency';
import { useStudentInvoices, useStudentPendingDues } from '@/hooks/useInvoices';
import type { Invoice, PendingDue } from '@/api/invoices';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { PaymentSection } from '@/components/parent/PaymentSection';
import { PendingDueCard } from '@/components/parent/PendingDueCard';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead } from '@/components/ui/SectionHead';
import { formatNumber } from '@/utils/format';
import { useState } from 'react';
import { ComplaintSheet, ComplaintPill } from '@/components/student/ComplaintSheet';
import { useMyComplaints } from '@/hooks/useComplaints';

const statusConfig = (): Record<string, { color: string }> => ({
  paid: { color: colors.success },
  pending: { color: colors.warning },
  overdue: { color: colors.danger },
});

export default function StudentInvoicesPage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: invoices, isLoading, isError, refetch } = useStudentInvoices();
  const { data: dues, refetch: refetchDues } = useStudentPendingDues();
  const { refreshing, onRefresh } = usePullRefresh(refetch, refetchDues);

  const totalDue = (invoices ?? []).filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const paidAmount = (invoices ?? []).filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const overdueCount = (invoices ?? []).filter((i) => i.status === 'overdue').length;

  // Each teacher bills independently → group the student's dues + invoices per
  // teacher, never one mixed pile. Items without a teacher fall under "أخرى".
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
        <PageHero
          title={t('invoices.title')}
          subtitle={formatDate(new Date())}
          compact
          stats={[
            { value: formatEGP(totalDue), label: t('invoices.total_due'), warn: totalDue > 0 },
            { value: formatEGP(paidAmount), label: t('invoices.paid_amount') },
            { value: formatNumber(overdueCount), label: t('invoices.overdue'), warn: overdueCount > 0 },
          ]}
        />

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
          {groups.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, ...shadows.sm }}>
              <EmptyState icon="invoices" title={t('invoices.no_invoices')} />
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.teacher} style={{ gap: spacing.md }}>
                {/* Per-teacher header — each teacher's bills stand on their own. */}
                <View style={{ marginTop: spacing.sm }}><SectionHead icon="teacher" color={colors.brand} title={group.teacher} /></View>
                {group.dues.map((due) => (
                  <PendingDueCard key={`due-${due.id}`} due={due} />
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
  const sc = statusConfig()[invoice.status] ?? statusConfig().pending;
  // «دفعت ولم يُسجَّل» — the student's dispute lives on the invoice it is about.
  const { byInvoice } = useMyComplaints();
  const complaint = byInvoice.get(Number(invoice.id));
  const [complainOpen, setComplainOpen] = useState(false);
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
      {complaint ? (
        <View style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}><ComplaintPill status={complaint.status} /></View>
      ) : invoice.status !== 'paid' ? (
        <TouchableOpacity onPress={() => setComplainOpen(true)} activeOpacity={0.8} accessibilityRole="button"
          style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSunken }}>
          <Icon name="note" size={16} color={colors.textSecondary} outline />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('complaints.file_payment')}</Text>
        </TouchableOpacity>
      ) : null}
      <ComplaintSheet visible={complainOpen} onClose={() => setComplainOpen(false)} target={{ type: 'payment', invoiceId: Number(invoice.id), invoiceNumber: invoice.number, amount: invoice.amount }} />
    </TouchableOpacity>
  );
}
