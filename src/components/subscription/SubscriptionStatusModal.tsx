import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useRose } from '@/hooks/useRose';
import { useWhatsNew } from '@/hooks/useReleaseNotes';
import { usePendingSurvey } from '@/hooks/useSurvey';
import { useTourStore } from '@/tour/store';
import { useOnboardingIntroPending, useRoseUnlockGate, useStatusPopupGate } from '@/hooks/usePopupTurn';
import { usePopupSlot } from '@/ui/popupSlot';
import { RosePortrait } from '@/components/rose/RoseStamp';
import { BrandMark } from '@/components/ui/BrandMark';
import { Surface } from '@/ui/surfaces';
import { subscriptionSheet } from './receipt';
import { SubscriptionSheetView } from './SubscriptionSheetView';

const HEAD = 76;
const BLOCKING_PREFIXES = [
  '/accept-terms', '/change-password', '/verify-own-number', '/impersonate', '/invite', '/login', '/register', '/verify-otp',
  '/forgot-password', '/reset-password', '/welcome', '/whats-new', '/subscription-wall', '/(teacher)/subscription', '/subscription',
];

/** Accounts that saw her sheet since the app was opened — once per opening, not on every return to the foreground. */
const shownThisLaunch = new Set<number>();

/**
 * مدام روز shows the teacher where the subscription stands each time the app is opened
 * (founder 2026-10-25): the paid term's receipt or the exemption with her GREEN stamp, an
 * open bill with her navy one, a late bill with her red one. Teachers only; a demo account,
 * a trial and a walled account (the wall says it) see nothing. It waits for the new teacher's
 * welcome, her unlock, «ما الجديد», the survey and a running tour.
 */
export function SubscriptionStatusModal() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const rose = useRose();
  const sheet = role === 'teacher' && user?.subscription?.exempt_reason !== 'demo' ? subscriptionSheet(user?.subscription, t, user?.gender === 'female') : null;

  const unlockPending = useRoseUnlockGate((s) => s.pending);
  const touring = useTourStore((s) => s.tour !== null);
  const { showPopup } = useWhatsNew();
  const { data: survey } = usePendingSurvey();
  const pathname = usePathname() ?? '';
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));

  const [seen, setSeen] = useState(() => (user ? shownThisLaunch.has(user.id) : true));
  useEffect(() => { setSeen(user ? shownThisLaunch.has(user.id) : true); }, [user?.id]);
  const close = () => {
    if (user) shownThisLaunch.add(user.id);
    setSeen(true);
  };

  // The tour waits for this sheet (to come or up); published for it.
  const pending = !!sheet && !seen && !blocked && !impersonating;
  useEffect(() => { useStatusPopupGate.setState({ pending }); }, [pending]);
  const introPending = useOnboardingIntroPending();
  const free = !!sheet && !seen && !unlockPending && !introPending && !touring && !showPopup && !survey && !blocked && !impersonating;
  // One popup at a time, a breath after the one before, never over another modal (src/ui/popupSlot.ts).
  const visible = usePopupSlot('subscription_status', free);
  if (!sheet) return null;
  const owing = sheet.kind === 'due' || sheet.kind === 'late';

  return (
    <Surface id="teacher.subscription.status_popup">
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.6)', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ paddingTop: HEAD / 2 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, paddingTop: HEAD / 2 + spacing.sm, ...shadows.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, textAlign: 'center' }}>{rose.name}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 25, color: colors.textPrimary, textAlign: 'center', marginTop: 4, marginBottom: spacing.md }}>{sheet.line}</Text>
            <SubscriptionSheetView sheet={sheet} animate={visible} />
            {owing ? (
              <>
                <TouchableOpacity onPress={() => { close(); router.push('/(teacher)/subscription' as Href); }} activeOpacity={0.85} accessibilityRole="button"
                  style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: sheet.kind === 'late' ? colors.danger : colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('subscription.status_pay')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={close} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('subscription.status_later')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={close} activeOpacity={0.85} accessibilityRole="button"
                  style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('subscription.status_ok')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { close(); router.push('/(teacher)/subscription' as Href); }} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('subscription.status_details')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ width: HEAD, height: HEAD, borderRadius: HEAD / 2, backgroundColor: colors.surface, borderWidth: 4, borderColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...shadows.sm }}>
              {rose.named ? <RosePortrait size={HEAD - 4} /> : <BrandMark size={36} />}
            </View>
          </View>
        </View>
      </View>
    </Modal>
    </Surface>
  );
}
