import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing, radius } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { useAuthStore, resolveRole } from '@/stores/authStore';
import { exchangeImpersonation } from '@/api/impersonation';
import { AuthScaffold } from '@/components/auth/AuthScaffold';

/**
 * drosspot://impersonate/{ticket} — a super-admin-minted mobile impersonation
 * hand-off. Redeems the one-time ticket for a short-lived impersonation session,
 * wipes any prior cached data, and drops into the impersonated person's own app.
 */
export default function ImpersonateScreen() {
  const { ticket } = useLocalSearchParams<{ ticket: string }>();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setSession = useAuthStore((s) => s.setSession);
  const setImpersonation = useAuthStore((s) => s.setImpersonation);
  const qc = useQueryClient();
  const [error, setError] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !ticket) return;
    ran.current = true;

    (async () => {
      try {
        const res = await exchangeImpersonation(ticket as string);
        // Order matters: tokens first, then session + impersonation flag, then a
        // full cache wipe so none of the super-admin's prior data leaks through.
        await setTokens(res.tokens.access_token, res.tokens.refresh_token ?? '');
        await setSession(res.user, resolveRole(res.user));
        await setImpersonation({ active: true, name: res.impersonation.name, write: res.impersonation.write });
        qc.clear();
        router.replace('/');
      } catch {
        setError(true);
      }
    })();
  }, [ticket, setTokens, setSession, setImpersonation, qc]);

  if (error) {
    return (
      <AuthScaffold icon="warning" title="تعذّر بدء التصفّح" subtitle="الرمز غير صالح أو منتهٍ.">
        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.85}
          style={{ backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse }}>حسنًا</Text>
        </TouchableOpacity>
      </AuthScaffold>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginTop: spacing.lg }}>
        جارٍ بدء جلسة التصفّح…
      </Text>
    </View>
  );
}
