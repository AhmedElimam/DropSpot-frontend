import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { generatePreCard, type PreCardToken } from '@/api/preCardInvitation';
import { Icon } from '@/components/ui/Icon';
import { PageHero } from '@/components/ui/PageHero';

/**
 * Pre-Card Invitation QR (spec §4). The parent, in-person with the teacher,
 * generates a one-time short-lived code and shows this screen to the teacher.
 * Emphasis is on "use it now" — a live countdown, not something to screenshot
 * and forward later.
 */
export default function InviteCodeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { data: children } = useChildren();
  const child = useMemo(() => (children ?? []).find((c) => c.id === params.id), [children, params.id]);

  const [token, setToken] = useState<PreCardToken | null>(null);
  const [remaining, setRemaining] = useState(0);

  const gen = useMutation({
    mutationFn: (studentId: number) => generatePreCard(studentId),
    onSuccess: (tok) => {
      setToken(tok);
      // The API's expires_in_seconds can be a float (Carbon diff) — floor it so the
      // countdown never shows fractional "milliseconds".
      setRemaining(Math.max(0, Math.floor(tok.expires_in_seconds)));
    },
  });

  // Auto-generate once the child is known.
  useEffect(() => {
    if (child && !token && !gen.isPending) {
      gen.mutate(child.student_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child]);

  // Countdown tick.
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining > 0]);

  const expired = !!token && remaining <= 0;
  const safe = Math.max(0, Math.floor(remaining));
  const mm = Math.floor(safe / 60);
  const ss = String(safe % 60).padStart(2, '0');

  const regenerate = () => {
    if (child) gen.mutate(child.student_id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <PageHero title={t('auth.invite_code_label')} subtitle={child?.name ?? undefined} onBack={true} compact />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl * 2, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl }}>
          {t('family_ui.invite_code_intro')}
        </Text>

        {gen.isPending && !token ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
        ) : gen.isError && !token ? (
          <ErrorBlock message={(gen.error as any)?.response?.data?.message || t('family_ui.invite_code_failed')} onRetry={regenerate} />
        ) : token ? (
          <>
            {/* QR + overlay when expired */}
            {/* Scanners want dark modules on white whatever the app's scheme — never theme the QR
                itself (the dark palette's ink is light, which made the code vanish). */}
            <View style={{ backgroundColor: '#FFFFFF', padding: spacing.xl, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
              <View style={{ opacity: expired ? 0.15 : 1 }}>
                <QRCode value={token.token} size={220} backgroundColor="#FFFFFF" color="#171C3B" />
              </View>
            </View>

            {/* Countdown */}
            {!expired ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg }}>
                <Icon name="clock" size={18} color={remaining <= 60 ? colors.warning : colors.textSecondary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: remaining <= 60 ? colors.warning : colors.textSecondary }}>
                  {mm}:{ss}
                </Text>
              </View>
            ) : (
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.danger, marginTop: spacing.lg }}>{t('family_ui.invite_code_expired')}</Text>
            )}

            {/* Numeric fallback */}
            <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
                {t('family_ui.invite_code_numeric_hint')}
              </Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 30, lineHeight: 40, letterSpacing: 6, color: colors.textPrimary, marginTop: spacing.xs, opacity: expired ? 0.3 : 1 }}>
                {token.numeric_code}
              </Text>
            </View>

            {/* Regenerate */}
            <TouchableOpacity
              onPress={regenerate}
              disabled={gen.isPending}
              activeOpacity={0.85}
              style={{ marginTop: spacing.xxl, flexDirection: 'row', gap: spacing.sm, backgroundColor: expired ? colors.brand : colors.surface, borderWidth: 1, borderColor: expired ? colors.brand : colors.border, borderRadius: radius.lg, minHeight: 52, paddingHorizontal: spacing.xxl, justifyContent: 'center', alignItems: 'center' }}
            >
              {gen.isPending ? (
                <ActivityIndicator color={expired ? colors.onPrimary : colors.brand} />
              ) : (
                <>
                  <Icon name="refresh" size={18} color={expired ? colors.onPrimary : colors.brand} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: expired ? colors.onPrimary : colors.brand }}>
                    {t('family_ui.invite_code_new')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
      <Icon name="error" size={40} color={colors.danger} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>{message}</Text>
      <TouchableOpacity onPress={onRetry} style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 48, paddingHorizontal: spacing.xxl, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>{t('common.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}
