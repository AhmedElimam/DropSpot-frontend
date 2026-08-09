import { Alert, TouchableOpacity, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useDeleteAccount } from '@/hooks/useAuth';

/**
 * In-app account deletion entry point (Apple App Store guideline 5.1.1(v)).
 * Shown in each role's settings/profile. Confirms with a destructive dialog,
 * then asks the server to delete the account and clears the local session (the
 * auth guards then route back to login). One shared component so the copy and
 * confirmation flow can't drift between the three screens.
 */
export function DeleteAccountButton() {
  const { t } = useTranslation();
  const del = useDeleteAccount();

  const confirm = () => {
    Alert.alert(
      t('common.delete_account'),
      t('common.delete_account_warning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete_account_confirm'), style: 'destructive', onPress: () => del.mutate() },
      ],
    );
  };

  return (
    <TouchableOpacity
      onPress={confirm}
      disabled={del.isPending}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={t('common.delete_account')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.dangerText,
        padding: spacing.lg,
        marginTop: spacing.md,
        minHeight: 52,
        opacity: del.isPending ? 0.6 : 1,
      }}
    >
      <Icon name="trash" size={20} color={colors.dangerText} outline />
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.dangerText }}>
        {t('common.delete_account')}
      </Text>
    </TouchableOpacity>
  );
}
