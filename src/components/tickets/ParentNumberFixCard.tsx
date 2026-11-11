import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/ui/dialog';
import { getFriendlyErrorMessage } from '@/utils/errors';
import type { ParentNumberFix } from '@/api/tickets';
import { useFixParentNumber } from '@/hooks/useTickets';

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 11);

/**
 * A student's «رقم ولي الأمر غلط» from activation (founder 2026-11-07), on the teacher's ticket:
 * the number on file, the one the student says is right (editable), and one press to apply it
 * — after calling the student. A request from before login is marked as not yet proved.
 */
export function ParentNumberFixCard({ ticketId, fix }: { ticketId: string; fix: ParentNumberFix }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState(fix.proposed ?? '');
  const apply = useFixParentNumber(ticketId);
  const valid = /^01\d{9}$/.test(phone);

  if (fix.applied_at) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successLight, borderRadius: radius.lg, padding: spacing.md }}>
        <Icon name="success" size={20} color={colors.success} />
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.successText }}>{t('tickets.fix_applied', { phone: fix.applied_number ?? '' })}</Text>
      </View>
    );
  }

  const confirm = () => {
    if (!valid) return;
    Alert.alert(t('tickets.fix_confirm_title'), t('tickets.fix_confirm_body', { phone }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('tickets.fix_apply'), onPress: () => apply.mutate(phone, { onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)) }) },
    ]);
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.warning, padding: spacing.md, gap: spacing.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('tickets.fix_title')}</Text>
      {!fix.from_link ? (
        <View style={{ flexDirection: 'row', gap: spacing.xs, backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm }}>
          <Icon name="warning" size={16} color={colors.warningDark} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.warningText }}>{t('tickets.fix_unproved')}</Text>
        </View>
      ) : null}
      <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary }}>
        {fix.current ? t('tickets.fix_current', { phone: fix.current }) : t('tickets.fix_no_current')}
      </Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary }}>{t('tickets.fix_right')}</Text>
      <TextInput
        value={phone}
        onChangeText={(v) => setPhone(digits(v))}
        keyboardType="phone-pad"
        maxLength={11}
        style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center', borderWidth: 1.5, borderColor: valid ? colors.border : colors.danger,
          borderRadius: radius.md, paddingVertical: 10, backgroundColor: colors.surfaceSunken, writingDirection: 'ltr' }}
      />
      <Button title={t('tickets.fix_apply')} onPress={confirm} disabled={!valid} loading={apply.isPending} />
    </View>
  );
}
