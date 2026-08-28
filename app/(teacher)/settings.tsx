import { View, Text, ScrollView, TouchableOpacity, Linking, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { Icon, type IconName } from '@/components/ui/Icon';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { SupportContact } from '@/components/SupportContact';
import { TeacherLogoRow } from '@/components/teacher/TeacherLogoRow';
import { useReviseMode, useSetReviseMode } from '@/hooks/useReviseMode';

// Minimal Settings tab. Real per-category notification toggles are deferred until
// a push-delivery pipeline exists to gate (there is nothing to switch on/off yet);
// for now the notifications row opens the OS settings.
export default function TeacherSettings() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const isAssistant = user?.user_type_id === 6;
  const { data: reviseOn } = useReviseMode();
  const setRevise = useSetReviseMode();

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
          {user?.is_founding_teacher ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,209,102,0.9)', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 }}>
              <Icon name="star" size={14} color="#FFD166" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#fff' }}>عضو مؤسس</Text>
            </View>
          ) : null}
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          {/* Courses & schedule management now live in the "الإدارة" tab. */}
          {/* Assistant management is teacher-only. */}
          {row('help', t('onboarding.getting_started_row'), t('onboarding.getting_started_row_sub'), () => router.push('/(teacher)/getting-started' as Href))}

          {/* The teacher's own brand logo (shown to parents). Teacher-only. */}
          {!isAssistant ? <TeacherLogoRow /> : null}

          {/* Revision / special-session switch — teacher & assistant; gates the
              special/exam-session entry across the app. */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
              borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
              padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm, minHeight: 64,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
              <Icon name="reports" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('teacher.revise_switch_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{t('teacher.revise_switch_sub')}</Text>
            </View>
            <Switch
              value={!!reviseOn}
              onValueChange={(v) => setRevise.mutate(v)}
              disabled={setRevise.isPending || reviseOn === undefined}
              trackColor={{ true: colors.brand, false: colors.border }}
              thumbColor="#fff"
            />
          </View>

          {!isAssistant ? row('children', t('assistants.title'), t('assistants.subtitle'), () => router.push('/(teacher)/assistants' as Href)) : null}
          {row('bell', t('teacher.notifications'), t('teacher.notifications_hint'), () => Linking.openSettings())}
          {row('lock', t('auth.change_password'), t('setup.password_hint'), () => router.push('/change-password'))}

          <View style={{ marginTop: spacing.md }}>
            <SupportContact />
          </View>

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

          <DeleteAccountButton />
        </View>
      </ScrollView>
    </View>
  );
}
