import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { router, type Href } from 'expo-router';
import { colors, spacing, radius } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { Icon } from '@/components/ui/Icon';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/config/support';
import { useAppConfigStore } from '@/stores/appConfigStore';

/**
 * Support card on the settings & profile screens.
 *
 * The primary route is now the Resolution Center — a real ticket in the admins' queue,
 * with a reason and a status the sender can watch (founder 2026-09-05: "direct them to
 * the resolution center to send the admin directly their issues"). An email draft and a
 * phone call left no record on either side and nothing anyone could route.
 *
 * The email and phone stay underneath, deliberately demoted: when the app itself is the
 * problem, a channel that lives outside it is the only one that still works. Values are
 * super-admin editable (backend AppConfig 'contact', delivered via /app-config); the
 * bundled constants are the fallback. RTL: rows use flexDirection 'row'.
 */
export function SupportContact({ href }: { href: Href }) {
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
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.xs }}>
        الدعم والتواصل
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.md }}>
        اختر سبب المشكلة وأرسلها للإدارة مباشرة، وتابع الرد داخل التطبيق.
      </Text>

      <TouchableOpacity
        onPress={() => router.push(href)}
        activeOpacity={0.85}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
          minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.primary,
        }}
      >
        <Icon name="ticket" size={18} color="#FFFFFF" />
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' }}>راسل الإدارة</Text>
      </TouchableOpacity>

      <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginBottom: spacing.xs }}>
          أو تواصل معنا خارج التطبيق:
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(`mailto:${email}`)}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}
        >
          <Icon name="mail" size={18} color={colors.textTertiary} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{email}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openURL(`tel:${phone}`)}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}
        >
          <Icon name="call" size={18} color={colors.textTertiary} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{phone}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
