import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { formatDate } from '@/utils/format';
import { formatEGP } from '@/utils/currency';
import { useInvoices } from '@/hooks/useInvoices';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';

const statusConfig: Record<string, { color: string }> = {
  paid: { color: colors.success },
  pending: { color: colors.warning },
  overdue: { color: colors.danger },
};

export default function InvoicesPage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: invoices, isLoading, isError, refetch } = useInvoices();

  const totalDue = (invoices ?? []).filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const paidAmount = (invoices ?? []).filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const overdueCount = (invoices ?? []).filter((i) => i.status === 'overdue').length;

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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
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
          {!invoices || invoices.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, ...shadows.sm }}>
              <EmptyState icon="invoices" title={t('invoices.no_invoices')} />
            </View>
          ) : (
            invoices.map((invoice) => {
              const sc = statusConfig[invoice.status] ?? statusConfig.pending;
              return (
                <TouchableOpacity
                  key={invoice.id}
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
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' }}>
                        {invoice.student_name && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Icon name="child" size={15} color={colors.textSecondary} outline style={{ marginEnd: 3 }} />
                            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{invoice.student_name}</Text>
                          </View>
                        )}
                        {invoice.teacher_name && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Icon name="teacher" size={15} color={colors.textSecondary} outline style={{ marginEnd: 3 }} />
                            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{invoice.teacher_name}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md }}>
                    <Text style={[textPresets.bodySmall]}>
                      {t('invoices.due_date')}: {invoice.due_date ? formatDate(new Date(invoice.due_date), { day: 'numeric', month: 'short' }) : '-'}
                    </Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.primary }}>{formatEGP(invoice.amount)}</Text>
                  </View>
                  {invoice.status !== 'paid' && (
                    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>
                        {t('invoices.pay_hint')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
