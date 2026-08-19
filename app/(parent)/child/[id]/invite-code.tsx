import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';
import { generatePreCard, type PreCardToken } from '@/api/preCardInvitation';
import { Icon } from '@/components/ui/Icon';

/**
 * Pre-Card Invitation QR (spec §4). The parent, in-person with the teacher,
 * generates a one-time short-lived code and shows this screen to the teacher.
 * Emphasis is on "use it now" — a live countdown, not something to screenshot
 * and forward later.
 */
export default function InviteCodeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { data: children } = useChildren();
  const child = useMemo(() => (children ?? []).find((c) => c.id === params.id), [children, params.id]);

  const [token, setToken] = useState<PreCardToken | null>(null);
  const [remaining, setRemaining] = useState(0);

  const gen = useMutation({
    mutationFn: (studentId: number) => generatePreCard(studentId),
    onSuccess: (t) => {
      setToken(t);
      // The API's expires_in_seconds can be a float (Carbon diff) — floor it so the
      // countdown never shows fractional "milliseconds".
      setRemaining(Math.max(0, Math.floor(t.expires_in_seconds)));
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
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[textPresets.h3, { flex: 1 }]}>رمز التسجيل</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl * 2, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center' }}>
          {child?.name ?? ''}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl }}>
          اعرض هذا الرمز للمعلم الآن ليُسجّل ابنك في حصصه. صالح لدقائق قليلة فقط — للاستخدام الفوري أمام المعلم، ولا يُرسل عبر واتساب.
        </Text>

        {gen.isPending && !token ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
        ) : gen.isError && !token ? (
          <ErrorBlock message={(gen.error as any)?.response?.data?.message || 'تعذّر إنشاء الرمز'} onRetry={regenerate} />
        ) : token ? (
          <>
            {/* QR + overlay when expired */}
            <View style={{ backgroundColor: '#fff', padding: spacing.xl, borderRadius: radius.xxl, ...shadows.sm }}>
              <View style={{ opacity: expired ? 0.15 : 1 }}>
                <QRCode value={token.token} size={220} backgroundColor="#fff" color={colors.ink ?? '#171C3B'} />
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
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.danger, marginTop: spacing.lg }}>انتهت صلاحية الرمز</Text>
            )}

            {/* Numeric fallback */}
            <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
                إن تعذّر مسح الرمز، أعطِ المعلم هذا الرقم:
              </Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 32, letterSpacing: 6, color: colors.textPrimary, marginTop: spacing.xs, opacity: expired ? 0.3 : 1 }}>
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
                <ActivityIndicator color={expired ? '#fff' : colors.brand} />
              ) : (
                <>
                  <Icon name="refresh" size={18} color={expired ? '#fff' : colors.brand} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: expired ? '#fff' : colors.brand }}>
                    إنشاء رمز جديد
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
  return (
    <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
      <Icon name="error" size={40} color={colors.danger} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>{message}</Text>
      <TouchableOpacity onPress={onRetry} style={{ marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 48, paddingHorizontal: spacing.xxl, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>إعادة المحاولة</Text>
      </TouchableOpacity>
    </View>
  );
}
