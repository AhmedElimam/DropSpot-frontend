import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { Icon, type IconName } from '@/components/ui/Icon';

// Minimal Settings tab. Real per-category notification toggles are deferred until
// a push-delivery pipeline exists to gate (there is nothing to switch on/off yet);
// for now the notifications row opens the OS settings.
export default function TeacherSettings() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const isAssistant = user?.user_type_id === 6;

  const row = (icon: IconName, label: string, sub: string, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
        borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm, minHeight: 64,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
        <Icon name={icon} size={22} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{label}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{sub}</Text>
      </View>
      <Icon name="back" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4, alignItems: 'center' }}
        >
          <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md }}>
            <Icon name="profile" size={40} color="#fff" />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{user?.name ?? ''}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
            {isAssistant ? t('teacher.role_assistant') : t('teacher.role_teacher')}
            {user?.phone ? ` · ${user.phone}` : ''}
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          {row('bell', t('teacher.notifications'), t('teacher.notifications_hint'), () => Linking.openSettings())}

          <TouchableOpacity
            onPress={() => logout.mutate()}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
              backgroundColor: colors.dangerLight, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.md, minHeight: 56,
            }}
          >
            <Icon name="logout" size={22} color={colors.dangerText} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.dangerText }}>{t('common.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
