import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, layout } from '@/theme/index';
import { formatDate, daysUntil } from '@/utils/format';
import { formatEGP } from '@/utils/currency';
import { toArabicDigits } from '@/utils/numerals';
import { useStudentInvoices, useStudentPendingDues } from '@/hooks/useInvoices';
import type { Invoice } from '@/api/invoices';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { PaymentProofButton } from '@/components/parent/PaymentProofButton';
import { PendingDueCard } from '@/components/parent/PendingDueCard';

export default function StudentInvoicesPage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: invoices, isLoading, isError, refetch } = useStudentInvoices();
  const { data: dues, refetch: refetchDues } = useStudentPendingDues();
  const { data: unread } = useUnreadCount();
  const { refreshing, onRefresh } = usePullRefresh(refetch, refetchDues);

  const allInvoices = invoices ?? [];
  const allDues = dues ?? [];
  const unpaidInvoices = allInvoices.filter((i) => i.status !== 'paid');
  const paidInvoices = allInvoices.filter((i) => i.status === 'paid');
  const totalDue = unpaidInvoices.reduce((s, i) => s + i.amount, 0) + allDues.reduce((s, d) => s + d.amount, 0);
  const overdueCount = allInvoices.filter((i) => i.status === 'overdue').length;
  const unpaidCount = unpaidInvoices.length + allDues.length;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding, paddingTop: insets.top + spacing.xxxl }}>
        <SkeletonList count={4} />
      </View>
    );
  }
  if (isError) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }}><ErrorState onRetry={() => refetch()} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: insets.top + spacing.md, paddingBottom: layout.tabBottom + insets.bottom, gap: layout.sectionGap }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Header: title + unpaid count, bell on the left */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 23, color: colors.ink, letterSpacing: -0.3 }}>{t('invoices.title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 }}>{t('invoices.unpaid_count', { count: unpaidCount })}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.navigate('/(student)/notifications' as never)}
            style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="bell" size={22} color={colors.ink} outline />
            {(unread ?? 0) > 0 ? <View style={{ position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, borderWidth: 1, borderColor: colors.surface }} /> : null}
          </TouchableOpacity>
        </View>

        {/* Total-due gradient summary */}
        <LinearGradient colors={gradients.brandCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: spacing.xl, ...shadows.hero, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, left: -50 }} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{t('invoices.total_outstanding')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 32, color: '#fff', letterSpacing: -1, marginTop: 5, marginBottom: 3 }}>
            {toArabicDigits(Math.round(totalDue))} <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>{t('common.egp')}</Text>
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
            {overdueCount > 0 ? t('invoices.overdue_count', { count: overdueCount }) : t('invoices.all_settled')}
          </Text>
        </LinearGradient>

        {/* Overdue block alert */}
        {overdueCount > 0 ? (
          <AlertBanner variant="danger" title={t('invoices.overdue_block_title')} message={t('invoices.overdue_block_desc')} />
        ) : null}

        {/* Unpaid dues + invoices */}
        {unpaidCount === 0 && paidInvoices.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, ...shadows.sm }}>
            <EmptyState icon="invoices" title={t('invoices.no_invoices')} />
          </View>
        ) : (
          <View style={{ gap: layout.cardGap }}>
            {allDues.map((due) => <PendingDueCard key={`due-${due.id}`} due={due} />)}
            {unpaidInvoices.map((invoice) => <InvoiceCard key={invoice.id} invoice={invoice} />)}
          </View>
        )}

        {/* Paid */}
        {paidInvoices.length > 0 ? (
          <View style={{ gap: layout.cardGap }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginStart: 2 }}>{t('invoices.paid_section')}</Text>
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, ...shadows.sm, overflow: 'hidden' }}>
              {paidInvoices.map((inv, i) => (
                <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line }}>
                  <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.goodWash, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="success" size={18} color={colors.good} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }} numberOfLines={1}>
                      {formatEGP(inv.amount)}{inv.teacher_name ? ` · ${inv.teacher_name}` : ''}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                      {(inv.items ?? [])[0] ?? inv.number}
                    </Text>
                  </View>
                  <StatusBadge status="paid" size="sm" />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** One unpaid invoice, spec `.inv` shape: big amount + status chip, teacher/course
 *  meta, due-date line, then the how-to-pay section (teacher's transfer targets). */
function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const days = invoice.due_date ? daysUntil(invoice.due_date) : 0;
  const overdue = invoice.status === 'overdue' || days < 0;
  const items = invoice.items ?? [];
  // The teacher accepts a transfer (Vodafone/InstaPay enabled) → show the pay-by-
  // transfer + upload-proof flow. Gated on `accepts_digital` (enabled) rather than
  // the numbers list, so enabling a method is enough — never "physical only".
  const hasDigital = invoice.accepts_digital === true || (invoice.payment_methods?.length ?? 0) > 0;
  const acceptsPhysical = invoice.accepts_physical !== false;

  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, ...shadows.sm, padding: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.ink, letterSpacing: -0.6 }}>
            {toArabicDigits(Math.round(invoice.amount))} <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.muted }}>{t('common.egp')}</Text>
          </Text>
          {invoice.teacher_name ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 3 }} numberOfLines={1}>
              {items[0] ? `${items[0]} — ${invoice.teacher_name}` : invoice.teacher_name}
            </Text>
          ) : null}
        </View>
        <StatusBadge status={invoice.status} size="sm" />
      </View>

      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: overdue ? colors.danger : colors.muted, marginTop: spacing.sm }}>
        {invoice.due_date
          ? (overdue ? t('invoices.overdue_since', { count: Math.abs(days) }) : `${t('invoices.due_date')}: ${formatDate(new Date(invoice.due_date), { day: 'numeric', month: 'short' })}`)
          : ''}
      </Text>

      {/* Foot (spec .inv .foot): pay + details. `دفع الآن` = the digital transfer
          sheet when the teacher offers one; otherwise a cash-only note. */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'stretch' }}>
        <View style={{ flex: 1 }}>
          {hasDigital ? (
            <PaymentProofButton invoice={invoice} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, height: 40, borderRadius: 15, backgroundColor: colors.brandWash }}>
              <Icon name="money" size={16} color={colors.brand} outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('invoices.cash_at_teacher')}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowDetails((v) => !v)} activeOpacity={0.85} style={{ width: 110, height: 40, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink }}>{t('invoices.details')}</Text>
        </TouchableOpacity>
      </View>

      {showDetails ? (
        <View style={{ marginTop: spacing.md, gap: 4 }}>
          {items.map((item, i) => (
            <Text key={i} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted }}>• {item}</Text>
          ))}
          {hasDigital && acceptsPhysical ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }}>{t('invoices.cash_also')}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
