import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { useAuthStore } from '@/stores/authStore';
import { usePendingSurvey } from '@/hooks/useSurvey';
import { useTeacherOnboarding } from '@/hooks/useTeacherOnboarding';
import { useWhatsNew } from '@/hooks/useReleaseNotes';
import { getTourStatus, completeTour } from '@/api/tour';
import { useTourStore, nextShowable } from './store';
import { tourSeen, markTourSeen } from './seen';
import { tourForRole } from './tours';
import { holeFor, placeCard, onScreen, HOLE_RADIUS, type Hole } from './geometry';

/** One glide between stops: unhurried, eased both ways, the same every time. */
const GLIDE = { duration: 560, easing: Easing.inOut(Easing.cubic) };
const GLIDE_CARD = { duration: 480, easing: Easing.out(Easing.cubic) };
/** The dim is one view with a border this thick — the inside is the hole (border trick: layout-only, no mask). */
const B = 2200;
/** How long a routed step waits for its target before it is skipped. */
const WAIT_FOR_TARGET_MS = 1800;

// Screens that must be finished first, and the door — never a spotlight mid-scan.
const BLOCKING_PREFIXES = [
  '/accept-terms', '/change-password', '/verify-own-number', '/parent-setup', '/needs-teacher',
  '/request-name-correction', '/impersonate', '/invite', '/login', '/register', '/verify-otp', '/forgot-password',
  '/reset-password', '/welcome', '/scan', '/enroll', '/whats-new',
];

/**
 * The spotlight tour (founder 2026-10-06: «a two-minute tour that teaches the app — smooth and
 * consistent»). One overlay for every role, mounted once at the root: the screen dims, a soft
 * hole glides from one control to the next, and a card names what the control does. Steps that
 * belong to another tab open that tab first, so the person sees the screen as it is named.
 *
 * The dim is a single view with an enormous border — the hole is its transparent inside — so
 * every frame is a layout change Reanimated runs on the UI thread; an SVG mask re-rendered each
 * frame was what stuttered. The first tour is the server's call: a person whose account has no
 * stamp gets it once, old accounts included, and cannot skip it; a replay from settings can.
 */
export function SpotlightOverlay() {
  const tour = useTourStore((s) => s.tour);
  useAutoStart();
  if (!tour) return null;
  return <Runner />;
}

/** Start the tour by itself, once, for anyone the server says has not had it — when their home is up and quiet. */
function useAutoStart() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const homeReady = useTourStore((s) => !!s.targets['home:stats']);
  const running = useTourStore((s) => s.tour !== null);
  const start = useTourStore((s) => s.start);
  const pathname = usePathname() ?? '';
  const { data: survey } = usePendingSurvey();
  const { data: onboarding } = useTeacherOnboarding();
  const { showPopup } = useWhatsNew();
  const eligible = !!user && !!role && !impersonating && !!tourForRole(role);
  const { data: status } = useQuery({ queryKey: ['tour-status', user?.id], queryFn: getTourStatus, enabled: eligible, staleTime: 5 * 60_000 });
  const onboardingDue = role === 'teacher' && !!onboarding && onboarding.active && !onboarding.steps.intro && !onboarding.has_courses;
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));
  const quiet = !survey && !onboardingDue && !showPopup && !blocked;
  const tried = useRef<string | null>(null);

  useEffect(() => {
    if (!eligible || running || !homeReady || !quiet || !status || status.completed) return;
    const def = tourForRole(role)!;
    const stamp = `${role}:${user!.id}`;
    if (tried.current === stamp) return;
    tried.current = stamp;
    let cancelled = false;
    // The phone remembers a finish the server never heard (offline at the time): no second run.
    tourSeen(role!, user!.id).then((seen) => {
      if (cancelled) return;
      if (seen) { void completeTour().catch(() => {}); return; }
      // A breath after the home screen settles, so the dim does not land on a loading spinner.
      setTimeout(() => { if (!cancelled && !useTourStore.getState().tour) start(def, { mandatory: true }); }, 900);
    });
    return () => { cancelled = true; };
  }, [eligible, running, homeReady, quiet, status, role, user, start]);
}

function Runner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const { tour, step, targets, mandatory, goTo, stop, remeasure } = useTourStore();
  const steps = tour!.steps;
  const current = steps[step];
  const rect = current?.target ? targets[current.target] : undefined;
  const visibleRect = rect && onScreen(rect, win) ? rect : undefined;

  // Open the step's screen, then ask every target to measure itself again.
  const routed = useRef<number>(-1);
  useEffect(() => {
    if (!current) return;
    if (current.route && routed.current !== step) {
      routed.current = step;
      try { router.navigate(current.route); } catch { /* already there, or gone: the measurement decides */ }
    }
    const t1 = setTimeout(remeasure, 80);
    const t2 = setTimeout(remeasure, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [step, current, remeasure]);

  const finish = useCallback(() => {
    if (role && user) {
      void markTourSeen(role, user.id);
      completeTour().then(() => qc.setQueryData(['tour-status', user.id], { completed: true, completed_at: new Date().toISOString() })).catch(() => {});
    }
    stop();
  }, [role, user, stop, qc]);

  const advance = useCallback((dir: 1 | -1 = 1) => {
    const next = nextShowable(steps, useTourStore.getState().targets, step, dir, role);
    if (next === null) { if (dir === 1) finish(); return; }
    goTo(next);
  }, [steps, step, goTo, finish, role]);

  // A spotlit step whose target never shows up (scrolled away, not on this build): move on.
  useEffect(() => {
    if (!current?.target || visibleRect) return;
    const t1 = setTimeout(() => {
      const r = useTourStore.getState().targets[current.target!];
      if (!r || !onScreen(r, win)) advance(1);
    }, WAIT_FOR_TARGET_MS);
    return () => clearTimeout(t1);
  }, [current, visibleRect, advance, win]);

  // ── the hole ──
  const hx = useSharedValue(win.width / 2);
  const hy = useSharedValue(win.height / 2);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const hr = useSharedValue(HOLE_RADIUS);
  const fade = useSharedValue(0);
  const [hole, setHole] = useState<Hole | null>(null);
  useEffect(() => { fade.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }); }, [fade]);
  useEffect(() => {
    if (visibleRect) {
      const h = holeFor(visibleRect, win);
      setHole(h);
      hx.value = withTiming(h.x, GLIDE); hy.value = withTiming(h.y, GLIDE);
      hw.value = withTiming(h.width, GLIDE); hh.value = withTiming(h.height, GLIDE);
      hr.value = withTiming(h.rx, GLIDE);
    } else {
      // A centred card, or a target not yet measured: the hole closes to a point mid-screen.
      setHole(null);
      hx.value = withTiming(win.width / 2, GLIDE); hy.value = withTiming(win.height / 2, GLIDE);
      hw.value = withTiming(0, GLIDE); hh.value = withTiming(0, GLIDE);
    }
  }, [visibleRect, win, hx, hy, hw, hh, hr]);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    left: hx.value - B, top: hy.value - B,
    width: hw.value + 2 * B, height: hh.value + 2 * B,
    borderRadius: hr.value + B,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: fade.value * (hw.value > 2 ? 1 : 0),
    left: hx.value - 3, top: hy.value - 3,
    width: hw.value + 6, height: hh.value + 6,
    borderRadius: hr.value + 3,
  }));

  // ── the card ──
  const [cardH, setCardH] = useState(200);
  const onCardLayout = (e: LayoutChangeEvent) => setCardH(e.nativeEvent.layout.height);
  const centred = !current?.target;
  const placed = hole ? placeCard(hole, cardH, win, insets) : null;
  const cardTop = useSharedValue(win.height / 2 - 100);
  useEffect(() => {
    const top = centred || !placed ? Math.max(insets.top + 24, (win.height - cardH) / 2) : placed.top;
    cardTop.value = withTiming(top, GLIDE_CARD);
  }, [centred, placed?.top, cardH, win.height, insets.top, cardTop]);
  const cardStyle = useAnimatedStyle(() => ({ top: cardTop.value, opacity: fade.value }));

  const spotSteps = steps.filter((s) => s.target).length;
  const spotIndex = steps.slice(0, step + 1).filter((s) => s.target).length;
  const last = nextShowable(steps, targets, step, 1, role) === null;
  const waiting = !!current?.target && !visibleRect;
  // The first tour cannot be skipped (founder 2026-10-06); a replay can.
  const canSkip = !mandatory;

  if (!current) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {/* Tapping the dim moves on — the quickest way through for someone who already knows. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => advance(1)} accessibilityLabel={t('tour.next')}>
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
          <Animated.View style={[{ position: 'absolute', borderWidth: B, borderColor: 'rgba(14, 19, 46, 0.66)' }, dimStyle]} />
          <Animated.View style={[{ position: 'absolute', borderWidth: 2.5, borderColor: colors.accent }, ringStyle]} />
        </View>
      </Pressable>

      <Animated.View onLayout={onCardLayout} style={[{ position: 'absolute', left: spacing.lg, right: spacing.lg }, cardStyle]}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.md }}>
          {centred ? (
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <BrandMark size={34} tint={colors.brand} />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
              {Array.from({ length: spotSteps }).map((_, i) => (
                <View key={i} style={{ height: 4, flex: i < spotIndex ? 1.6 : 1, borderRadius: 2, backgroundColor: i < spotIndex ? colors.accent : colors.border }} />
              ))}
            </View>
          )}
          <Text style={{ fontFamily: fonts.bold, fontSize: centred ? 22 : 17.5, lineHeight: centred ? 30 : 25, color: colors.textPrimary, textAlign: centred ? 'center' : 'right' }}>{t(current.title)}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 23, color: colors.textSecondary, marginTop: 6, textAlign: centred ? 'center' : 'right' }}>{t(current.body)}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
            <Pressable onPress={() => { if (current.href) { finish(); router.push(current.href); } else advance(1); }} accessibilityRole="button"
              style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.onPrimary }}>
                {current.cta ? t(current.cta) : last ? t('tour.finish') : t('tour.next')}
              </Text>
              {!current.cta && !last ? <Icon name="back" size={16} color={colors.onPrimary} /> : null}
            </Pressable>
            {step > 0 && !last ? (
              <Pressable onPress={() => advance(-1)} accessibilityRole="button" accessibilityLabel={t('tour.back')} hitSlop={6}
                style={({ pressed }) => ({ width: 48, height: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
                <Icon name="forward" size={18} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          {canSkip && (!last || current.href) ? (
            <Pressable onPress={finish} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginTop: 2 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textTertiary }}>{t(current.href ? 'tour.later_short' : step === 0 ? 'tour.later' : 'tour.skip')}</Text>
            </Pressable>
          ) : !canSkip && current.href ? (
            <Pressable onPress={finish} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginTop: 2 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textTertiary }}>{t('tour.later_short')}</Text>
            </Pressable>
          ) : null}
          {waiting ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: 4 }}>{t('tour.opening')}</Text> : null}
        </View>
      </Animated.View>
    </View>
  );
}
