import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { useRose } from '@/hooks/useRose';
import { useWhatsNew } from '@/hooks/useReleaseNotes';
import { usePendingSurvey } from '@/hooks/useSurvey';
import { useTourStore } from '@/tour/store';
import { useOnboardingIntroPending, useRoseUnlockGate, useSettled } from '@/hooks/usePopupTurn';
import { NazerUnlockStage, RiseIn, type UnlockPhase } from '@/components/nazer/NazerUnlockStage';
import { BrandMark } from '@/components/ui/BrandMark';

const KEY = 'rose2_unlocked';

const LOGO = 64;
const BLOCKING_PREFIXES = [
  '/accept-terms', '/change-password', '/verify-own-number', '/impersonate', '/invite', '/login', '/register', '/verify-otp',
  '/forgot-password', '/reset-password', '/welcome', '/whats-new', '/subscription-wall',
];

/**
 * «مدام روز بشكل جديد» (founder 2026-10-25): the first time a teacher or an assistant opens
 * the app after her painted look arrived, she is unlocked like الناظر was for the families —
 * her silhouette under a padlock, a tap, the reveal — once per account on this phone. It
 * waits for «ما الجديد» and the survey, and never shows over a running tour.
 */
export function RoseUnlockModal() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const rose = useRose();
  const staff = role === 'teacher' || role === 'assistant';
  const key = user ? `${KEY}:${user.id}` : null;
  const [seen, setSeen] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!key || !staff) return;
    setSeen(undefined);
    AsyncStorage.getItem(key).then((v) => setSeen(v === '1')).catch(() => setSeen(true));
  }, [key, staff]);

  const touring = useTourStore((s) => s.tour !== null);
  const { showPopup } = useWhatsNew();
  const { data: survey } = usePendingSurvey();
  const pathname = usePathname() ?? '';
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));

  const done = () => {
    setSeen(true);
    if (key) AsyncStorage.setItem(key, '1').catch(() => {});
  };

  const pending = staff && rose.named && seen !== true;
  useEffect(() => { useRoseUnlockGate.setState({ pending }); }, [pending]);

  const [phase, setPhase] = useState<UnlockPhase>('lock');
  // A teacher who switched her name off keeps her out of the way: no popup either.
  // After a brand-new teacher's welcome, and a breath after it closed: two iOS modals presented
  // together leave one invisible over the screen (2026-10-25, a fresh login froze on it).
  const introPending = useOnboardingIntroPending();
  const visible = useSettled(staff && rose.named && seen === false && !introPending && !touring && !showPopup && !survey && !blocked && !impersonating);
  if (!staff) return null;

  const points = [1, 2, 3].map((n) => t(`rose_unlock.point_${n}`));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={done}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.6)', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ paddingTop: LOGO / 2 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, overflow: 'hidden', ...shadows.md }}>
          <NazerUnlockStage play={visible} onPhase={setPhase} character="rose" />
          <RiseIn show={phase === 'done'}>
          <View style={{ padding: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 25, color: colors.textPrimary, textAlign: 'center' }}>{t('rose_unlock.hello', { name: rose.name })}</Text>
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
            <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 21, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md }}>{t('rose_unlock.signoff')}</Text>
            <TouchableOpacity onPress={() => { done(); router.push('/(teacher)/cash-reconcile' as Href); }} activeOpacity={0.85} accessibilityRole="button"
              style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('rose_unlock.enter_desk')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={done} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('rose_unlock.later')}</Text>
            </TouchableOpacity>
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
