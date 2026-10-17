import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, gradients, radius, spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BETA_GOLD, BETA_INK } from '@/components/ui/Beta';
import { useAuthStore } from '@/stores/authStore';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { pickFeatureTerms, useFeatureTermsStore } from '@/stores/featureTermsStore';
import { acceptFeatureTerms } from '@/api/featureTerms';
import { getFriendlyErrorMessage } from '@/utils/errors';
import type { FeatureTermsDoc } from '@/config/defaults';

/**
 * A feature's add-on agreement (founder 2026-10-17: «when we activate chat for a certain
 * teacher it changes the UI and pulls the new agreement — threads and the print shop the
 * same»). The base Terms never change for it; this asks only the people the feature reached.
 *
 * It opens by itself once, when the feature arrives (/app-config `feature_terms`), wherever the
 * person is — except over a screen that must be finished first or at the door. «لاحقًا» puts it
 * off for this session: the feature stays closed on the server (423) until accepted, and the
 * first touch of it opens this again (`useFeatureTermsStore.open`, from an entry point or the API
 * client). Accepting stamps the server's version, drops the item, and refetches what the 423
 * had refused. One agreement at a time; the next due one follows.
 */
const BLOCKING_PREFIXES = [
  '/accept-terms', '/change-password', '/verify-own-number', '/parent-setup', '/needs-teacher',
  '/request-name-correction', '/impersonate', '/invite', '/login', '/register', '/verify-otp', '/forgot-password',
  '/reset-password', '/welcome', '/scan', '/enroll', '/check-in',
];

const ICONS: Record<string, IconName> = { course_chat: 'chat', threads: 'threads', print_market: 'note' };

export function FeatureTermsPrompt() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const due = useAppConfigStore((s) => s.config.feature_terms ?? NONE);
  const later = useFeatureTermsStore((s) => s.later);
  const asked = useFeatureTermsStore((s) => s.asked);
  const pathname = usePathname() ?? '';

  const signedIn = !!user && (role === 'teacher' || role === 'assistant' || role === 'student' || role === 'parent');
  const gated = !!user?.must_accept_terms || !!user?.must_set_password;
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));
  const doc = signedIn && !gated && !blocked && !impersonating ? pickFeatureTerms(due, later, asked) : null;
  if (!doc) return null;
  // Keyed by the document: ticking the box for chat never carries over to حكاوي.
  return <Agreement key={`${doc.key}:${doc.version}`} doc={doc} />;
}
const NONE: FeatureTermsDoc[] = [];

function Agreement({ doc }: { doc: FeatureTermsDoc }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);
  const beta = useAppConfigStore((s) => (s.config.feature_beta ?? []).includes(doc.key));

  const accept = useMutation({
    mutationFn: () => acceptFeatureTerms(doc.key),
    onSuccess: () => {
      useAppConfigStore.getState().dropFeatureTerms(doc.key);
      useFeatureTermsStore.getState().done(doc.key);
      // Whatever the feature refused with 423 while this was due loads now.
      void queryClient.invalidateQueries();
    },
  });
  const later = () => useFeatureTermsStore.getState().putOff(doc.key);

  return (
    <Modal visible animationType="slide" onRequestClose={later}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center', borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
          <View style={{ width: 76, height: 76, borderRadius: 26, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={ICONS[doc.key] ?? 'shield'} size={36} color={colors.onHero} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.onHero }}>{t(doc.update ? 'feature_terms.badge_update' : 'feature_terms.badge_new')}</Text>
            </View>
            {beta ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: BETA_GOLD }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: BETA_INK }}>{t('beta.chip')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 34, color: colors.onHero, marginTop: spacing.sm, textAlign: 'center' }}>{doc.title}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.onHeroSoft, textAlign: 'center', marginTop: 2 }}>{t(doc.update ? 'feature_terms.sub_update' : 'feature_terms.sub_new')}</Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 25, color: colors.textPrimary }}>{doc.heading}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: 4 }}>{doc.intro}</Text>
          <View style={{ marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md }}>
            {doc.body.map((line, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{(i + 1).toLocaleString('ar-EG')}</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 23, color: colors.textPrimary }}>{line}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary, marginTop: spacing.sm }}>{t('feature_terms.addon_note', { version: doc.version })}</Text>
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={() => setChecked((v) => !v)} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 }}>
            <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: checked ? colors.brand : colors.borderStrong, backgroundColor: checked ? colors.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {checked ? <Icon name="success" size={15} color="#FFFFFF" /> : null}
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 21, color: colors.textPrimary }}>{doc.checkbox}</Text>
          </TouchableOpacity>
          {accept.isError ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger, marginTop: 4 }}>{getFriendlyErrorMessage(accept.error)}</Text> : null}
          <TouchableOpacity onPress={() => accept.mutate()} disabled={!checked || accept.isPending} activeOpacity={0.85} accessibilityRole="button"
            style={{ marginTop: spacing.sm, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, opacity: checked ? 1 : 0.45, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            {accept.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' }}>{t('feature_terms.accept')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={later} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.sm, marginTop: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary }}>{t('feature_terms.later')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
