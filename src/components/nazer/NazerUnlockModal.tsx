import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { useWhatsNew } from '@/hooks/useReleaseNotes';
import { usePendingSurvey } from '@/hooks/useSurvey';
import { useTourStore } from '@/tour/store';
import { getTourStatus } from '@/api/tour';
import { NazerUnlockStage, RiseIn, type UnlockPhase } from './NazerUnlockStage';
import { BrandMark } from '@/components/ui/BrandMark';

const KEY = 'nazer_unlocked';
const LOGO = 64;
const BLOCKING_PREFIXES = [
  '/accept-terms', '/change-password', '/verify-own-number', '/parent-setup', '/needs-teacher',
  '/request-name-correction', '/impersonate', '/invite', '/login', '/register', '/verify-otp', '/forgot-password',
  '/reset-password', '/welcome', '/check-in', '/whats-new',
];

/**
 * «شخصية جديدة» (founder 2026-10-22): the first time a parent or student opens the app after
 * الناظر arrived, he introduces himself — who he is and what he does for them — once per
 * account on this phone. A new account meets him here too, BEFORE the tour (founder
 * 2026-10-23: «new people don't know this is a new character»): the first tour waits for this
 * popup (`introHeld`), and its one button hands over to the tour he narrates. It waits for
 * «ما الجديد», the survey and a running tour, one popup at a time.
 */
export function NazerUnlockModal() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const family = role === 'parent' || role === 'student';
  const key = user ? `${KEY}:${user.id}` : null;
  const [seen, setSeen] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!key || !family) return;
    setSeen(undefined);
    AsyncStorage.getItem(key).then((v) => setSeen(v === '1')).catch(() => setSeen(true));
  }, [key, family]);

  const { data: tour } = useQuery({ queryKey: ['tour-status', user?.id], queryFn: getTourStatus, enabled: !!user && family && seen === false, staleTime: 5 * 60_000 });
  const touring = useTourStore((s) => s.tour !== null);
  const { showPopup } = useWhatsNew();
  const { data: survey } = usePendingSurvey();
  const pathname = usePathname() ?? '';
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));

  const done = () => {
    setSeen(true);
    if (key) AsyncStorage.setItem(key, '1').catch(() => {});
  };
  // Until this account has met him on this phone, a first tour waits for him.
  const setIntroHeld = useTourStore((s) => s.setIntroHeld);
  useEffect(() => {
    setIntroHeld(family && !impersonating && seen !== true);
  }, [family, impersonating, seen, setIntroHeld]);

  const [phase, setPhase] = useState<UnlockPhase>('lock');
  // A first visit: the tour comes straight after him, so the popup leads into it.
  const firstTime = !!tour && !tour.completed;
  const visible = family && seen === false && !!tour && !touring && !showPopup && !survey && !blocked && !impersonating;
  if (!family) return null;

  const who = role === 'parent' ? 'parent' : 'student';
  const office = (role === 'parent' ? '/(parent)/nazer' : '/(student)/nazer') as Href;
  const points = [1, 2, 3].map((n) => t(`nazer_unlock.${who}_${n}`));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={done}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.6)', justifyContent: 'center', padding: spacing.lg }}>
        {/* The app's popup shape (src/ui/dialog.tsx): the brand mark in a white circle over the
            card's top edge (founder 2026-10-22: «the logo on top of the popup, like our popups»). */}
        <View style={{ paddingTop: LOGO / 2 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, overflow: 'hidden', ...shadows.md }}>
          {/* His band is the stage of the unlock (NazerUnlockStage): locked, broken open, revealed. */}
          <NazerUnlockStage play={visible} onPhase={setPhase} />


          <RiseIn show={phase === 'done'}>
          <View style={{ padding: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 25, color: colors.textPrimary, textAlign: 'center' }}>{t(`nazer_unlock.${who}_hello`)}</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {points.map((p) => (
                <View key={p} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <Icon name="success" size={13} color={colors.brand} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>{p}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 21, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md }}>{t('nazer_unlock.signoff')}</Text>

            <TouchableOpacity onPress={() => { done(); if (!firstTime) router.push(office); }} activeOpacity={0.85} accessibilityRole="button"
              style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t(firstTime ? 'nazer_unlock.start_tour' : 'nazer_unlock.enter_office')}</Text>
            </TouchableOpacity>
            {firstTime ? <View style={{ height: spacing.md }} /> : (
              <TouchableOpacity onPress={done} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('nazer_unlock.later')}</Text>
              </TouchableOpacity>
            )}
          </View>
          </RiseIn>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ width: LOGO, height: LOGO, borderRadius: LOGO / 2, backgroundColor: colors.surface, borderWidth: 4, borderColor: colors.background, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}>
            <BrandMark size={32} />
          </View>
        </View>
        </View>
      </View>
    </Modal>
  );
}
