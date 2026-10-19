import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, AppState, type AppStateStatus } from 'react-native';
import { AppModal as Modal } from '@/ui/AppModal';
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
/** A foreground re-checks the version at most this often (a launch always checks). */
export const TERMS_RECHECK_MS = 15 * 60_000;
let lastTermsCheckAt = 0;

export function TermsUpdateModal() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);

  const [deferred, setDeferred] = useState(false);
  const checking = useRef(false);

  const termsRole: TermsRole =
    role === 'student' ? 'student' : role === 'parent' ? 'parent' : role === 'assistant' ? 'assistant' : 'teacher';

  // Ask the server whether this user still stands on the current version — on mount
  // and on a foreground at most every TERMS_RECHECK_MS (it asked on EVERY return before:
  // 2026-10-19 staging audit). Silent on failure: a network blip must never invent a
  // consent prompt, and the launch gate still catches the user either way.
  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;

    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      lastTermsCheckAt = Date.now();
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
      if (s === 'active' && Date.now() - lastTermsCheckAt >= TERMS_RECHECK_MS) check();
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, [isAuthenticated, setSession]);

  const wanted = !!isAuthenticated && !!user?.must_accept_terms && !!user?.terms_update && !deferred;
  // Nothing to show (the usual case): no legal text fetched, no route subscription — the
  // sheet below mounts only for a person who has an update waiting.
  if (!wanted) return null;
  return <TermsUpdateSheet termsRole={termsRole} onLater={() => setDeferred(true)} />;
}

function TermsUpdateSheet({ termsRole, onLater }: { termsRole: TermsRole; onLater: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { changesFor } = useTermsContent();
  const changes = changesFor(termsRole);

  // Never over the acceptance screen itself — there the document IS the screen.
  // (The auth stack needs no check: this only renders for a signed-in user.)
  if (pathname === '/accept-terms') return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onLater}>
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

          <TouchableOpacity onPress={onLater} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>
              {t('terms.update_later')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
