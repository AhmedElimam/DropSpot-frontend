import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control, shadows } from '@/theme/index';
import { useAuthStore, resolveRole } from '@/stores/authStore';
import { refreshToken as refreshTokenApi } from '@/api/auth';
import { Icon } from '@/components/ui/Icon';

/**
 * Self-registration wall. A student who signed up on their own lands here until a
 * teacher on the platform enrolls them. Nothing to do but hand their code/number to
 * a teacher and re-check — the wall lifts the moment an enrollment exists.
 */
export default function NeedsTeacherScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [stillWaiting, setStillWaiting] = useState(false);

  const user = useAuthStore((s) => s.user);
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
      if (data.user?.needs_teacher_invitation) {
        setStillWaiting(true); // teacher hasn't added them yet
      } else {
        router.replace('/' as Href);
      }
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center' }}
      >
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
          <Icon name="children" size={38} color="#fff" />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: '#fff', textAlign: 'center' }}>{t('needs_teacher.title')}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 26, color: colors.textSecondary, textAlign: 'right' }}>
            {t('needs_teacher.message')}
          </Text>

          {/* The identifiers a teacher uses to find and add them. */}
          <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg, gap: spacing.md }}>
            {user?.student_code ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textTertiary }}>{t('needs_teacher.your_code')}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{user.student_code}</Text>
              </View>
            ) : null}
            {user?.phone ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textTertiary }}>{t('needs_teacher.your_phone')}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, writingDirection: 'ltr' }}>{user.phone}</Text>
              </View>
            ) : null}
          </View>

          {stillWaiting && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.warningLight ?? colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg }}>
              <Icon name="clock" size={16} color={colors.warning} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'right' }}>
                {t('needs_teacher.still_waiting')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => { setStillWaiting(false); check.mutate(); }}
            disabled={check.isPending}
            activeOpacity={0.85}
            style={{ borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.xl }}
          >
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}>
              {check.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>{t('needs_teacher.check_again')}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => logout()} style={{ marginTop: spacing.md, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textTertiary }}>{t('needs_teacher.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
