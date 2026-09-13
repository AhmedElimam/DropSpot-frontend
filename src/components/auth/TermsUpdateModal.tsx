import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { getTermsState, type TermsRole } from '@/api/terms';
import { useTermsContent } from '@/hooks/useTermsContent';

/**
 * "الاتفاقية تم تحديثها" — the re-consent popup, mounted once in the root layout so
 * it can reach a user wherever they are in the app.
 *
 * WHY A POLL: every publish is meant to re-prompt everyone, but the flag rides on
 * the auth payload and an access token lives 15 days — so a user already signed in
 * would not have heard about a new version until their next login. This asks the
 * server on app-open and on each foreground, and raises the popup on the spot.
 *
 * WHY "لاحقًا" EXISTS: this popup only ever arrives EARLIER than the blocking gate
 * it precedes — the index route still refuses to let anyone past `must_accept_terms`
 * on the next launch. Deferring therefore cannot weaken consent; it only avoids
 * yanking a teacher out of a half-finished attendance run. It defers for this app
 * session, and comes back on the next foreground.
 *
 * Only for people who have consented BEFORE (`terms_update`). A first-time
 * acceptance is not an update and goes straight to the full document.
 */
export function TermsUpdateModal() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);

  const [deferred, setDeferred] = useState(false);
  const checking = useRef(false);

  const termsRole: TermsRole =
    role === 'student' ? 'student' : role === 'parent' ? 'parent' : role === 'assistant' ? 'assistant' : 'teacher';

  const { changesFor } = useTermsContent();
  const changes = changesFor(termsRole);

  // Ask the server whether this user still stands on the current version — on mount
  // and on every foreground. Silent on failure: a network blip must never invent a
  // consent prompt, and the launch gate still catches the user either way.
  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;

    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const state = await getTermsState();
        if (!alive) return;
        const current = useAuthStore.getState().user;
        const currentRole = useAuthStore.getState().role;
        if (!current || !currentRole) return;
        if (
          current.must_accept_terms !== state.must_accept_terms ||
          current.terms_update !== state.terms_update
        ) {
          await setSession(
            { ...current, must_accept_terms: state.must_accept_terms, terms_update: state.terms_update },
            currentRole,
          );
          // A version they haven't seen: let it interrupt again even if the previous
          // one was deferred this session.
          if (state.must_accept_terms) setDeferred(false);
        }
      } catch {
        // ignore
      } finally {
        checking.current = false;
      }
    };

    check();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') check();
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, [isAuthenticated, setSession]);

  // Never over the acceptance screen itself — there the document IS the screen.
  // (The auth stack needs no check: this only renders for a signed-in user.)
  const onGateScreen = pathname === '/accept-terms';

  const visible =
    !!isAuthenticated && !!user?.must_accept_terms && !!user?.terms_update && !deferred && !onGateScreen;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setDeferred(true)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.xl,
            paddingBottom: spacing.xl + insets.bottom / 2,
            maxHeight: '80%',
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: colors.brand + '18',
              justifyContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Icon name="terms" size={30} color={colors.brand} />
          </View>

          <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, textAlign: 'center' }}>
            {t('terms.update_title')}
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 14,
              lineHeight: 22,
              color: colors.textSecondary,
              textAlign: 'center',
              marginTop: spacing.sm,
            }}
          >
            {t('terms.update_body')}
          </Text>

          {changes.length > 0 && (
            <ScrollView
              style={{ marginTop: spacing.lg }}
              contentContainerStyle={{ paddingBottom: spacing.xs }}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 14,
                  color: colors.textPrimary,
                  textAlign: 'right',
                  marginBottom: spacing.sm,
                }}
              >
                {t('terms.update_whats_new')}
              </Text>
              {changes.map((line, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm }}
                >
                  <View
                    style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 8 }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fonts.regular,
                      fontSize: 13.5,
                      lineHeight: 22,
                      color: colors.textSecondary,
                      textAlign: 'right',
                    }}
                  >
                    {line}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            onPress={() => router.push('/accept-terms' as Href)}
            activeOpacity={0.85}
            style={{
              marginTop: spacing.xl,
              minHeight: 50,
              borderRadius: radius.lg,
              backgroundColor: colors.primary,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('terms.update_review')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setDeferred(true)} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>
              {t('terms.update_later')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
