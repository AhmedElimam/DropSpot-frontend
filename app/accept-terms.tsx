import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control, shadows } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { acceptTerms, type TermsRole } from '@/api/terms';
import { useTermsContent } from '@/hooks/useTermsContent';
import { TermsConsentRow } from '@/components/auth/TermsConsentRow';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';

/**
 * Blocking Terms-acceptance gate. Reached from the index router when the user's
 * must_accept_terms flag is set — teachers on first app open, and anyone
 * grandfathered in or hit by a material version bump. Role-aware copy: the
 * document differs for student (rules acknowledgment) / parent (agreement) /
 * teacher (service agreement). Declining means signing out — there is no way past.
 */
export default function AcceptTermsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [accepted, setAccepted] = useState(false);

  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);

  const termsRole: TermsRole =
    role === 'student' ? 'student' : role === 'parent' ? 'parent' : role === 'assistant' ? 'assistant' : 'teacher';

  // They consented to an earlier version and the agreement has since changed — say
  // that, and lead with what changed, instead of handing them a first-time document.
  const isUpdate = !!user?.terms_update;

  // Live (super-admin editable) content, falling back to the bundled copy.
  const { contentFor, changesFor } = useTermsContent();
  const changes = isUpdate ? changesFor(termsRole) : [];
  const live = contentFor(termsRole);
  const heading = live?.heading ?? t(`terms.heading_${termsRole}`);
  const intro = live?.intro ?? t(`terms.intro_${termsRole}`);
  const bullets = live?.body ?? (t(`terms.body_${termsRole}`, { returnObjects: true }) as string[]);

  const accept = useMutation({
    mutationFn: () => acceptTerms(),
    onSuccess: async () => {
      // MUST await: setSession updates the in-memory store only AFTER an async
      // SecureStore write. Navigating before it lands makes the index gate still
      // read must_accept_terms=true and bounce straight back to this screen (the
      // "accept once, it reloads; accept again, it passes" bug).
      if (user && role) await setSession({ ...user, must_accept_terms: false, terms_update: false }, role);
      router.replace('/' as Href);
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg }}
      >
        {isUpdate && (
          <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: spacing.xs }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t('terms.update_badge')}</Text>
          </View>
        )}
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: '#fff' }}>{heading}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}>
          {isUpdate && (
            <View style={{ backgroundColor: colors.brand + '10', borderWidth: 1, borderColor: colors.brand + '33', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand, textAlign: 'right', marginBottom: changes.length ? spacing.sm : 0 }}>
                {changes.length ? t('terms.update_whats_new') : t('terms.update_body')}
              </Text>
              {changes.map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 8 }} />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 22, color: colors.textSecondary, textAlign: 'right' }}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={{ fontFamily: fonts.medium, fontSize: 15, lineHeight: 24, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.lg }}>
            {intro}
          </Text>

          {bullets.map((line, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 9 }} />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 23, color: colors.textSecondary, textAlign: 'right' }}>
                {line}
              </Text>
            </View>
          ))}

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.lg }} />

          {accept.isError && (
            <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.danger }}>
              <Icon name="warning" size={18} color={colors.danger} style={{ marginEnd: spacing.sm }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.dangerText, flex: 1 }}>
                {getFriendlyErrorMessage(accept.error)}
              </Text>
            </View>
          )}

          <TermsConsentRow role={termsRole} checked={accepted} onToggle={setAccepted} />

          <TouchableOpacity
            onPress={() => accept.mutate()}
            disabled={!accepted || accept.isPending}
            activeOpacity={0.85}
            style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: !accepted ? 0.5 : 1 }}
          >
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}
            >
              {accept.isPending ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>
                  {t('terms.accept_button')}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => logout()}
            style={{ marginTop: spacing.md, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textTertiary }}>{t('terms.decline_logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
