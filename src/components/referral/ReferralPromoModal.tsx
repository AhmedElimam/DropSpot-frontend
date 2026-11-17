import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { AppModal as Modal } from '@/ui/AppModal';
import { usePopupSlot } from '@/ui/popupSlot';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Surface } from '@/ui/surfaces';
import { useAuthStore } from '@/stores/authStore';
import { useReferral } from '@/hooks/useReferral';
import { useReferralPromoGate } from '@/hooks/useReferralPromoGate';
import { useOnboardingIntroPending, useRoseUnlockGate, useStatusPopupGate } from '@/hooks/usePopupTurn';
import { useWhatsNew } from '@/hooks/useReleaseNotes';
import { usePendingSurvey } from '@/hooks/useSurvey';
import { useTourStore } from '@/tour/store';
import { tourForRole } from '@/tour/tours';
import { getTourStatus } from '@/api/tour';
import { referralReward, referralStashCount, referralTerms } from '@/api/referral';
import { formatNumber } from '@/utils/format';
import { promoAudience, tickerSteps } from './promoGate';

const BLOCKING_PREFIXES = [
  '/accept-terms', '/change-password', '/verify-own-number', '/impersonate', '/invite', '/login', '/register', '/verify-otp',
  '/forgot-password', '/reset-password', '/welcome', '/whats-new', '/subscription-wall', '/subscription', '/referral',
];
/** Every other popup has had its say this long before the reminder asks for its turn. */
const SETTLE_MS = 1500;

const GOLD = '#E8C55A';
const GOLD_DEEP = '#C9A227';
const RIBBON = '#E06A75';
// Fixed, so every phone plays the same burst: round dots only (no star shapes).
const DOTS = Array.from({ length: 10 }, (_, i) => ({
  a: ((i * 36 + 12) * Math.PI) / 180, d: 52 + ((i * 17) % 22), s: 5 + (i % 3) * 2,
  c: [GOLD, '#F2EFE6', RIBBON, '#7C8BE0'][i % 4],
}));
const FAN = [{ r: -16, x: -16 }, { r: 0, x: 0 }, { r: 16, x: 16 }];

const n0 = (v: number) => formatNumber(v, { maximumFractionDigits: 0 });

/**
 * «ادعُ معلّمًا» reminder (founder 2026-11-17): a founding teacher, on app open, at most once a
 * week, after every other popup (it is last in POPUP_ORDER and waits out the welcome, مدام روز's
 * unlock and status sheet, «ما الجديد», the survey and the tour). A gift box pops open, then the
 * two prizes come in one after the other: the invited teacher's 30–80% (a short count-up) and
 * the inviter's 100 free QR cards (a little stack that fans out). Each motion is a single burst
 * when it opens — nothing loops; reduced motion shows the final state at once.
 */
export function ReferralPromoModal() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const audience = promoAudience({ role, founding: user?.is_founding_teacher && user.user_type_id !== 6, impersonating });

  const { due, markShown } = useReferralPromoGate(audience && user ? user.id : null);
  const { data: info } = useReferral(audience && due === true);

  // The others first: each publishes whether it is still to come, or is checked as they check.
  const unlockPending = useRoseUnlockGate((s) => s.pending);
  const statusPending = useStatusPopupGate((s) => s.pending);
  const introPending = useOnboardingIntroPending();
  const { showPopup } = useWhatsNew();
  const { data: survey } = usePendingSurvey();
  const touring = useTourStore((s) => s.tour !== null);
  const hasTour = audience && !!tourForRole(role);
  const { data: tourStatus } = useQuery({ queryKey: ['tour-status', user?.id], queryFn: getTourStatus, enabled: hasTour && due === true, staleTime: 5 * 60_000 });
  const tourDone = !touring && (!hasTour || !!tourStatus?.completed);
  const pathname = usePathname() ?? '';
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));

  const [closed, setClosed] = useState(false);
  useEffect(() => { setClosed(false); }, [user?.id]);

  const ready = audience && due === true && !!info?.available && !closed && !blocked
    && !unlockPending && !statusPending && !introPending && !showPopup && !survey && tourDone;
  // A breath after the last popup's own decision, so a slow one is never overtaken.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!ready) { setSettled(false); return; }
    const id = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(id);
  }, [ready]);
  // One popup at a time, a breath after the one before, never over another modal (src/ui/popupSlot.ts).
  const visible = usePopupSlot('referral_promo', ready && settled);
  useEffect(() => { if (visible) markShown(); }, [visible, markShown]);

  if (!audience || !info?.available) return null;
  const terms = referralTerms(info);
  const reward = referralReward(info);
  const stash = referralStashCount(info);

  const close = () => setClosed(true);
  const invite = () => { close(); router.push('/(teacher)/referral' as Href); };

  return (
    <Surface id="teacher.referral.promo_popup">
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.6)', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, overflow: 'hidden', ...shadows.md }}>
          {visible ? <PromoShow min={terms.min} max={terms.max} cards={reward.cards} stash={stash} onInvite={invite} onLater={close} /> : null}
        </View>
      </View>
    </Modal>
    </Surface>
  );
}

/** Mounted only while the popup is up: it plays once on mount and stops everything on unmount. */
function PromoShow({ min, max, cards, stash, onInvite, onLater }: {
  min: number; max: number; cards: number; stash: number; onInvite: () => void; onLater: () => void;
}) {
  const { t } = useTranslation();
  const still = useReducedMotion();
  const pop = useSharedValue(still ? 1 : 0);
  const wobble = useSharedValue(0);
  const lid = useSharedValue(still ? 1 : 0);
  const burst = useSharedValue(still ? 1 : 0);
  const tile1 = useSharedValue(still ? 1 : 0);
  const tile2 = useSharedValue(still ? 1 : 0);
  const fan = useSharedValue(still ? 1 : 0);
  const [pct, setPct] = useState(still ? max : min);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const all = [pop, wobble, lid, burst, tile1, tile2, fan];
    if (still) { setPct(max); return; }
    const out = Easing.out(Easing.cubic);
    // The box springs up with a little shake, the lid flies off, a ring of dots bursts out…
    pop.value = withSpring(1, { damping: 8, stiffness: 150 });
    wobble.value = withSequence(...[-10, 8, -5, 3, 0].map((a) => withTiming(a, { duration: 100 })));
    lid.value = withDelay(480, withSpring(1, { damping: 9, stiffness: 120 }));
    burst.value = withDelay(500, withTiming(1, { duration: 700, easing: out }));
    // …then the two prizes, one after the other.
    tile1.value = withDelay(800, withTiming(1, { duration: 360, easing: out }));
    tile2.value = withDelay(1150, withTiming(1, { duration: 360, easing: out }));
    fan.value = withDelay(1350, withSpring(1, { damping: 10, stiffness: 110 }));
    // The count-up: a handful of steps from 900 ms, settled on the top figure by ~1.9 s.
    tickerSteps(min, max).forEach((v, i) => { timers.current.push(setTimeout(() => setPct(v), 900 + i * 170)); });
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      all.forEach((v) => cancelAnimation(v));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, min, max]);

  const boxStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 3),
    transform: [{ scale: 0.3 + 0.7 * pop.value }, { rotate: `${wobble.value}deg` }],
  }));
  const lidStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -22 * lid.value }, { translateX: -8 * lid.value }, { rotate: `${-18 * lid.value}deg` }],
  }));

  return (
    <>
      <LinearGradient colors={[...gradients.auth]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xl, overflow: 'hidden' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: GOLD, letterSpacing: 0.3 }}>{t('referral_promo.kicker')}</Text>
        <View style={{ width: 160, height: 116, alignItems: 'center', justifyContent: 'flex-end', marginTop: spacing.sm }}>
          {DOTS.map((d, i) => <BurstDot key={i} dot={d} burst={burst} />)}
          <Animated.View style={[{ alignItems: 'center' }, boxStyle]}>
            <Animated.View style={[{ alignItems: 'center', zIndex: 2 }, lidStyle]}>
              <View style={{ flexDirection: 'row', gap: 4, marginBottom: -2 }}>
                <View style={{ width: 16, height: 12, borderRadius: 6, backgroundColor: RIBBON, transform: [{ rotate: '-24deg' }] }} />
                <View style={{ width: 16, height: 12, borderRadius: 6, backgroundColor: RIBBON, transform: [{ rotate: '24deg' }] }} />
              </View>
              <View style={{ width: 92, height: 22, borderRadius: 7, backgroundColor: GOLD_DEEP, alignItems: 'center' }}>
                <View style={{ width: 14, height: 22, backgroundColor: RIBBON }} />
              </View>
            </Animated.View>
            <View style={{ width: 80, height: 58, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: GOLD, alignItems: 'center' }}>
              <View style={{ width: 14, height: 58, backgroundColor: RIBBON }} />
            </View>
          </Animated.View>
        </View>
      </LinearGradient>

      <View style={{ padding: spacing.lg }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: colors.textPrimary, textAlign: 'center' }}>{t('referral_promo.title')}</Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <RiseTile show={tile1}>
            <View style={{ minWidth: 72, height: 56, paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 34, color: colors.brand }} numberOfLines={1}>{t('referral_promo.pct', { n: n0(pct) })}</Text>
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.textPrimary }}>
              {t('referral_promo.discount_label', { min: n0(min), max: n0(max) })}
            </Text>
          </RiseTile>
          <RiseTile show={tile2}>
            <View style={{ width: 72, height: 56, alignItems: 'center', justifyContent: 'center' }}>
              {FAN.map((f, i) => <FanCard key={i} rot={f.r} dx={f.x} fan={fan} />)}
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.textPrimary }}>
              {t('referral_promo.cards_label', { n: n0(cards) })}
            </Text>
          </RiseTile>
        </View>

        {stash > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, borderRadius: radius.lg, backgroundColor: colors.successLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
            <Icon name="gift" size={18} color={colors.successText} />
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 21, color: colors.successText }}>
              {stash === 1 ? t('referral_promo.stash_line_one') : t('referral_promo.stash_line', { n: n0(stash) })}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={onInvite} activeOpacity={0.85} accessibilityRole="button"
          style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
          <Icon name="share" size={18} color={colors.onPrimary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('referral_promo.invite_now')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLater} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('referral_promo.later')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function BurstDot({ dot, burst }: { dot: (typeof DOTS)[number]; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const b = burst.value;
    return {
      opacity: b <= 0 || b >= 1 ? 0 : b < 0.2 ? b / 0.2 : 1 - (b - 0.2) / 0.8,
      transform: [{ translateX: Math.cos(dot.a) * dot.d * b }, { translateY: -Math.abs(Math.sin(dot.a)) * dot.d * b - 30 }],
    };
  });
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: 'absolute', bottom: 30, width: dot.s, height: dot.s, borderRadius: dot.s / 2, backgroundColor: dot.c }, style]} />
  );
}

function RiseTile({ show, children }: { show: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: show.value, transform: [{ translateY: (1 - show.value) * 16 }] }));
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surfaceSunken, padding: spacing.sm }, style]}>
      {children}
    </Animated.View>
  );
}

/** One small QR card of the stack; the three fan out from one pile. */
function FanCard({ rot, dx, fan }: { rot: number; dx: number; fan: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: dx * fan.value }, { rotate: `${rot * fan.value}deg` }] }));
  return (
    <Animated.View style={[{ position: 'absolute', width: 32, height: 44, borderRadius: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name="scan" size={20} color={colors.brand} />
    </Animated.View>
  );
}
