import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatEGP } from '@/utils/currency';
import type { PendingDue } from '@/api/invoices';

/**
 * One outstanding non-invoice due (a booklet fee or a booking down-payment),
 * shared by the student and parent invoice screens. Shows what's owed and how to
 * pay — the teacher's configured transfer methods (informational) and/or a cash
 * note. There is no proof-upload here: these are settled in person / by transfer,
 * and always surface regardless of the teacher's payment-method setup.
 */
export function PendingDueCard({ due, showStudent }: { due: PendingDue; showStudent?: boolean }) {
  const { t } = useTranslation();

  const hasDigital = (due.payment_methods?.length ?? 0) > 0;
  const acceptsPhysical = due.accepts_physical !== false;
  const kindColor = due.kind === 'booking' ? colors.primary : colors.info;

  return (
    <View
      style={{
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
        borderRadius: radius.xl, padding: spacing.xl, borderStartWidth: 4, borderStartColor: colors.warning,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: kindColor + '22', paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: kindColor }}>{due.title}</Text>
            </View>
            {due.course_name ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>{due.course_name}</Text>
            ) : null}
          </View>

          {showStudent && due.student_name ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              {due.student_name}
            </Text>
          ) : null}

          {due.teacher_name ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Icon name="teacher" size={14} color={colors.textSecondary} outline style={{ marginEnd: 3 }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{due.teacher_name}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.primary }}>{formatEGP(due.amount)}</Text>
          {due.status === 'partial' ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.successText, marginTop: 2 }}>
              {t('dues.paid_of', { paid: formatEGP(due.paid), total: formatEGP(due.total) })}
            </Text>
          ) : null}
        </View>
      </View>

      {/* How to pay — informational only. */}
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {hasDigital ? (
          <View style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }}>
            {due.payment_methods!.map((m, i) => (
              <View key={i}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{m.label}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }} selectable>{m.number}</Text>
                {m.name ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
                    {t('invoices.expected_name')}: {m.name}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {acceptsPhysical ? (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
              backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
              borderRadius: radius.md, padding: spacing.md,
            }}
          >
            <Icon name="money" size={18} color={colors.textSecondary} outline />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
              {t(hasDigital ? 'invoices.cash_also' : 'invoices.cash_only')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
