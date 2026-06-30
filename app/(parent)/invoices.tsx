import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { formatDate } from '@/utils/format';
import { formatEGP } from '@/utils/currency';

interface Invoice {
  id: string;
  number: string;
  amount: number;
  dueDate: Date;
  status: 'paid' | 'pending' | 'overdue';
  items: string[];
}

const MOCK_INVOICES: Invoice[] = [
  { id: '1', number: 'INV-2026-007', amount: 850, dueDate: new Date(2026, 5, 15), status: 'paid', items: ['الرياضيات - الصف الثالث الإعدادي', 'العلوم - الصف الثالث الإعدادي'] },
  { id: '2', number: 'INV-2026-008', amount: 850, dueDate: new Date(2026, 6, 15), status: 'pending', items: ['الرياضيات - الصف الثالث الإعدادي', 'العلوم - الصف الثالث الإعدادي'] },
  { id: '3', number: 'INV-2026-009', amount: 600, dueDate: new Date(2026, 5, 1), status: 'overdue', items: ['اللغة العربية - الصف الأول الإعدادي'] },
  { id: '4', number: 'INV-2026-005', amount: 600, dueDate: new Date(2026, 4, 15), status: 'paid', items: ['اللغة العربية - الصف الأول الإعدادي'] },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: 'invoices.paid', color: colors.success, bg: colors.successLight },
  pending: { label: 'invoices.pending', color: colors.warning, bg: colors.warningLight },
  overdue: { label: 'invoices.overdue', color: colors.danger, bg: colors.dangerLight },
};

export default function InvoicesPage() {
  const { t } = useTranslation();

  const totalDue = MOCK_INVOICES.filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const paidAmount = MOCK_INVOICES.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#4F46E5', '#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', letterSpacing: -0.5 }}>
            {t('invoices.title')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs }}>
            {formatDate(new Date())}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{totalDue}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{t('invoices.total_due')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{paidAmount}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{t('invoices.paid_amount')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>1</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{t('invoices.overdue')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          {MOCK_INVOICES.map((invoice) => {
            const sc = statusConfig[invoice.status];
            return (
              <TouchableOpacity
                key={invoice.id}
                activeOpacity={0.7}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: radius.xl,
                  padding: spacing.xl,
                  ...shadows.md,
                  borderStartWidth: 4,
                  borderStartColor: sc.color,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text style={textPresets.subtitle}>{invoice.number}</Text>
                      <View style={{ backgroundColor: sc.bg, paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.full }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: sc.color }}>{t(sc.label)}</Text>
                      </View>
                    </View>
                    {invoice.items.map((item, i) => (
                      <Text key={i} style={[textPresets.bodySmall, { marginTop: 2 }]}>{item}</Text>
                    ))}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md }}>
                  <Text style={[textPresets.bodySmall]}>
                    {t('invoices.due_date')}: {formatDate(invoice.dueDate, { day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.primary }}>{formatEGP(invoice.amount)}</Text>
                </View>
                {invoice.status !== 'paid' && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={{ borderRadius: radius.md, overflow: 'hidden', marginTop: spacing.md }}
                  >
                    <LinearGradient
                      colors={invoice.status === 'overdue' ? gradients.warm : gradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ paddingVertical: 12, alignItems: 'center' }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('invoices.pay_now')}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
