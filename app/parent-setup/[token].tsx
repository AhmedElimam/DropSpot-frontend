import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control } from '@/theme/index';
import { getParentSetup } from '@/api/auth';
import { useParentSetup } from '@/hooks/useAuth';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';
import { AuthScaffold } from '@/components/auth/AuthScaffold';

const label = { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.sm } as const;
const field = {
  fontFamily: fonts.regular,
  fontSize: 17,
  minHeight: control.minHeight,
  backgroundColor: colors.surfaceSunken,
  borderRadius: radius.lg,
  paddingHorizontal: spacing.lg,
  paddingVertical: 14,
  color: colors.textPrimary,
  textAlign: 'right' as const,
  borderWidth: 1.5,
};

export default function ParentSetupScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState('');

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ['parent-setup', token],
    queryFn: () => getParentSetup(token as string),
    enabled: !!token,
    retry: false,
  });

  const setupMutation = useParentSetup();

  const submit = () => {
    if (!token || password.length < 6) return;
    setupMutation.mutate(
      { token: token as string, password },
      { onSuccess: () => router.replace('/(parent)') },
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (isError || !info) {
    return (
      <AuthScaffold icon="warning" title={t('setup.invalid_title')} subtitle={t('setup.invalid_link')}>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.85}
          style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse }}>{t('setup.go_login')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold icon="profile" title={t('setup.title')} subtitle={t('setup.subtitle')}>
      {setupMutation.isError && (
        <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.danger }}>
          <Icon name="warning" size={18} color={colors.danger} style={{ marginEnd: spacing.sm }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.dangerText, flex: 1 }}>
            {getFriendlyErrorMessage(setupMutation.error)}
          </Text>
        </View>
      )}

      {/* Read-only: the parent confirms who they are, but can't edit it. */}
      <Text style={label}>{t('setup.name')}</Text>
      <TextInput
        value={info.name}
        editable={false}
        style={{ ...field, marginBottom: spacing.lg, borderColor: colors.border, backgroundColor: colors.surfaceSunken, color: colors.textSecondary }}
      />

      <Text style={label}>{t('setup.phone')}</Text>
      <TextInput
        value={info.phone_number}
        editable={false}
        style={{ ...field, marginBottom: spacing.lg, borderColor: colors.border, backgroundColor: colors.surfaceSunken, color: colors.textSecondary, textAlign: 'left' }}
      />

      <Text style={label}>{t('setup.password')}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={colors.textTertiary}
        style={{ ...field, marginBottom: spacing.xs, borderColor: password ? colors.brand : colors.borderStrong }}
      />
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.xxl }}>
        {t('setup.password_hint')}
      </Text>

      <TouchableOpacity
        onPress={submit}
        disabled={password.length < 6 || setupMutation.isPending}
        activeOpacity={0.85}
        style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: password.length < 6 ? 0.5 : 1 }}
      >
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>
            {setupMutation.isPending ? t('setup.saving') : t('setup.submit')}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </AuthScaffold>
  );
}
