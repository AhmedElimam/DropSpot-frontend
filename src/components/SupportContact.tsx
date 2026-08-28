import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { colors, spacing, radius } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { Icon } from '@/components/ui/Icon';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/config/support';
import { useAppConfigStore } from '@/stores/appConfigStore';

/**
 * Support / contact card, shown on the settings & profile screens. Values are
 * super-admin editable (backend AppConfig 'contact', delivered via /app-config);
 * the bundled constants are the fallback. Email opens the mail app, phone the dialer.
 * RTL: rows use flexDirection 'row'.
 */
export function SupportContact() {
  const contact = useAppConfigStore((s) => s.config.contact);
  const email = contact?.support_email || SUPPORT_EMAIL;
  const phone = contact?.support_phone || SUPPORT_PHONE;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.md }}>
        الدعم والتواصل
      </Text>

      <TouchableOpacity
        onPress={() => Linking.openURL(`mailto:${email}`)}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}
      >
        <Icon name="mail" size={20} color={colors.brand} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{email}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => Linking.openURL(`tel:${phone}`)}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}
      >
        <Icon name="call" size={20} color={colors.brand} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{phone}</Text>
      </TouchableOpacity>
    </View>
  );
}
