import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { fonts } from '@/theme/typography';
import { colors, spacing, gradients } from '@/theme/index';
import { useAuthStore, resolveRole } from '@/stores/authStore';
import { refreshToken as refreshTokenApi } from '@/api/auth';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { SubscriptionPanel } from '@/components/subscription/SubscriptionPanel';
import { ROUTE_BY_ROLE } from '@/utils/routes';

/**
 * The wall. A teacher whose subscription bill passed its block date (45 days) lands here
 * from app/index.tsx and from any 402 SUBSCRIPTION_BLOCKED answer. No way back into the
 * app: only the bill, where to pay, «دفعت», a re-check, and sign-out. The wall lifts the
 * moment the ops room records the payment — «تحديث الحالة» re-reads the login payload.
 */
export default function SubscriptionWallScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const setSession = useAuthStore((s) => s.setSession);
  const setTokens = useAuthStore((s) => s.setTokens);
  const logout = useAuthStore((s) => s.logout);

  const check = useMutation({
    mutationFn: async () => {
      const rt = await SecureStore.getItemAsync('refresh_token');
      if (!rt) throw new Error('no-refresh');
      return refreshTokenApi(rt);
    },
    onSuccess: async (data) => {
      await setTokens(data.tokens.access_token, data.tokens.refresh_token);
      await setSession(data.user, resolveRole(data.user));
      if (!data.user?.subscription_blocked) router.replace(ROUTE_BY_ROLE);
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={gradients.auth} style={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={30} color={colors.onHero} />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.onHero, textAlign: 'center' }}>{t('subscription.wall_title')}</Text>
      </LinearGradient>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <SubscriptionPanel walled />
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Button title={t('subscription.refresh')} variant="outline" onPress={() => check.mutate()} loading={check.isPending} />
          <TouchableOpacity onPress={() => logout()} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textTertiary }}>{t('subscription.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
