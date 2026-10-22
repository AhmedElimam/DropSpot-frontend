import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppModal as Modal } from '@/ui/AppModal';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { useWhatsNew } from '@/hooks/useReleaseNotes';
import { usePendingSurvey } from '@/hooks/useSurvey';
import { useTourStore } from '@/tour/store';
import { getTourStatus } from '@/api/tour';
import { NazerFace } from './NazerFace';
import { NazerStamp } from './NazerStamp';

const KEY = 'nazer_unlocked';
const BLOCKING_PREFIXES = [
  '/accept-terms', '/change-password', '/verify-own-number', '/parent-setup', '/needs-teacher',
  '/request-name-correction', '/impersonate', '/invite', '/login', '/register', '/verify-otp', '/forgot-password',
  '/reset-password', '/welcome', '/check-in', '/whats-new',
];

/**
 * «شخصية جديدة» (founder 2026-10-22): the first time a parent or student opens the app after
 * الناظر arrived, he introduces himself — who he is and what he does for them — once per
 * account on this phone. A new account meets him in the tour he narrates, so it is not shown
 * there; and it waits for «ما الجديد», the survey and a running tour, one popup at a time.
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
  // A new account has not had the tour yet: he introduces himself there instead.
  useEffect(() => {
    if (seen === false && tour && !tour.completed) done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, tour]);

  const visible = family && seen === false && !!tour?.completed && !touring && !showPopup && !survey && !blocked && !impersonating;
  if (!family) return null;

  const who = role === 'parent' ? 'parent' : 'student';
  const office = (role === 'parent' ? '/(parent)/nazer' : '/(student)/nazer') as Href;
  const points = [1, 2, 3].map((n) => t(`nazer_unlock.${who}_${n}`));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={done}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.6)', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, overflow: 'hidden', ...shadows.md }}>
          {/* His band: the office navy, «شخصية جديدة» unlocked, his face large with the stamp. */}
          <LinearGradient colors={[...gradients.auth]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
              <Icon name="success" size={13} color={colors.accent} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#FFFFFF' }}>{t('nazer_unlock.badge')}</Text>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <NazerFace mood="proud" size={132} />
              <NazerStamp kind="approved" size={56} style={{ position: 'absolute', bottom: -4, end: -20 }} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: '#FFFFFF', marginTop: spacing.sm }}>{t('nazer.name')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>{t('nazer.role')}</Text>
          </LinearGradient>

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

            <TouchableOpacity onPress={() => { done(); router.push(office); }} activeOpacity={0.85} accessibilityRole="button"
              style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('nazer_unlock.enter_office')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={done} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('nazer_unlock.later')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
