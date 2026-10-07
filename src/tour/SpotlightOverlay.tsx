import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { Image } from 'expo-image';
import { useRose } from '@/hooks/useRose';
import { useAuthStore } from '@/stores/authStore';
import { usePendingSurvey } from '@/hooks/useSurvey';
import { useTeacherOnboarding } from '@/hooks/useTeacherOnboarding';
import { useWhatsNew } from '@/hooks/useReleaseNotes';
import { getTourStatus, completeTour } from '@/api/tour';
import { useTourStore, nextShowable } from './store';
import { tourSeen, markTourSeen } from './seen';
import { tourForRole } from './tours';
import { holeFor, placeCard, onScreen, toFrame, holePath, stackDim, scrollNeeded, HOLE_RADIUS, type Hole, type Frame } from './geometry';

const ARect = Animated.createAnimatedComponent(Rect);
const APath = Animated.createAnimatedComponent(Path);
// A slow, calm glide between stops (founder 2026-10-06: «the frames between steps a quite slow»).
const SPRING = { damping: 26, stiffness: 70, mass: 1.1 };
const CARD_SPRING = { damping: 24, stiffness: 95, mass: 1 };
// مدام روز's nod as each step opens — her own small motion; the hole's glide is untouched.
const NOD_SPRING = { damping: 9, stiffness: 150, mass: 0.9 };
const ROSE = require('../../assets/images/rose/madam-rose.webp');
/** Her portrait on a centred card / a spotlight card; half of it rises above the card. */
const ROSE_BIG = 104;
const ROSE_SMALL = 58;
/** How long a routed step waits for its target before it is skipped. */
const WAIT_FOR_TARGET_MS = 1800;
/** When targets measure again after a step opens: a slow phone may still be sliding the screen in at 400 ms. */
const REMEASURE_MS = [80, 350, 800, 1500];

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
 * The first tour is the server's call: a person whose account has no stamp gets it once, old
 * accounts included, and cannot skip it; a replay from settings can. Never over another popup
 * or a screen that must be finished first.
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
  // Narrow subscriptions: every TourTarget on screen re-registers as it lays out, and the
  // overlay must not redraw for a target it is not showing.
  const tour = useTourStore((s) => s.tour);
  const step = useTourStore((s) => s.step);
  const mandatory = useTourStore((s) => s.mandatory);
  const goTo = useTourStore((s) => s.goTo);
  const stop = useTourStore((s) => s.stop);
  const remeasure = useTourStore((s) => s.remeasure);
  const steps = tour!.steps;
  const current = steps[step];
  // The teacher side's tour is presented by مدام روز (her name as this person's screens show it).
  const narrated = tour!.narrator === 'rose';
  const rose = useRose();
  const nod = useSharedValue(1);
  useEffect(() => {
    if (!narrated) return;
    nod.value = 0.84;
    nod.value = withSpring(1, NOD_SPRING);
  }, [step, narrated, nod]);
  const nodStyle = useAnimatedStyle(() => ({ transform: [{ scale: nod.value }, { rotate: `${(1 - nod.value) * -36}deg` }] }));
  const rawRect = useTourStore((s) => (current?.target ? s.targets[current.target] : undefined));
  const last = useTourStore((s) => nextShowable(steps, s.targets, step, 1, role) === null);

  // The overlay's own frame in the window, measured the same way the targets are — never
  // assumed to be the window (Android phones differ by status bar, notch, navigation bar).
  const rootRef = useRef<View>(null);
  const [frame, setFrame] = useState<Frame>({ x: 0, y: 0, width: win.width, height: win.height });
  const measureRoot = useCallback(() => {
    rootRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setFrame((f) => (f.x === x && f.y === y && f.width === width && f.height === height ? f : { x, y, width, height }));
      }
    });
  }, []);
  const area = useMemo(() => ({ width: frame.width, height: frame.height }), [frame.width, frame.height]);
  const rect = useMemo(() => (rawRect ? toFrame(rawRect, frame) : undefined), [rawRect, frame]);
  const visibleRect = rect && onScreen(rect, area) ? rect : undefined;

  // Open the step's screen, then ask every target to measure itself again.
  const routed = useRef<number>(-1);
  useEffect(() => {
    if (!current) return;
    if (current.route && routed.current !== step) {
      routed.current = step;
      try { router.navigate(current.route); } catch { /* already there, or gone: the measurement decides */ }
    }
    const timers = REMEASURE_MS.map((ms) => setTimeout(() => { remeasure(); measureRoot(); }, ms));
    return () => timers.forEach(clearTimeout);
  }, [step, current, remeasure, measureRoot]);

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

  // A target scrolled away (the home scrolled a little before a replay, founder 2026-10-07):
  // scroll the screen until it sits between the status bar and the tab bar, then measure again.
  // The tab bar's own buttons are fixed — never scroll for them. Twice at most per step.
  const scrolls = useRef({ step: -1, count: 0 });
  useEffect(() => {
    const id = current?.target;
    if (!id || id.startsWith('tab:') || !rect) return;
    const dy = scrollNeeded(rect, area, insets.top, nav.bottomHeight + insets.bottom);
    if (Math.abs(dy) < 4) return;
    if (scrolls.current.step !== step) scrolls.current = { step, count: 0 };
    if (scrolls.current.count >= 2) return;
    const scroller = useTourStore.getState().scroller;
    if (!scroller) return;
    scrolls.current.count += 1;
    scroller.api.scrollBy(dy);
    const timers = [320, 650].map((ms) => setTimeout(remeasure, ms));
    return () => timers.forEach(clearTimeout);
  }, [current, step, rect, area, insets.top, insets.bottom, remeasure]);

  // A spotlit step whose target never shows up (scrolled away, not on this build): move on.
  useEffect(() => {
    if (!current?.target || visibleRect) return;
    const t1 = setTimeout(() => {
      const r = useTourStore.getState().targets[current.target!];
      if (!r || !onScreen(toFrame(r, frame), area)) advance(1);
    }, WAIT_FOR_TARGET_MS);
    return () => clearTimeout(t1);
  }, [current, visibleRect, advance, frame, area]);

  // ── the hole, animated ──
  const hx = useSharedValue(win.width / 2);
  const hy = useSharedValue(win.height / 2);
  const W = useSharedValue(win.width);
  const H = useSharedValue(win.height);
  useEffect(() => { W.value = area.width; H.value = area.height; }, [area, W, H]);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const hr = useSharedValue(HOLE_RADIUS);
  const dim = useSharedValue(0);
  const [hole, setHole] = useState<Hole | null>(null);
  useEffect(() => { dim.value = withTiming(1, { duration: 260 }); }, [dim]);
  useEffect(() => {
    if (visibleRect) {
      const h = holeFor(visibleRect, area);
      setHole(h);
      hx.value = withSpring(h.x, SPRING); hy.value = withSpring(h.y, SPRING);
      hw.value = withSpring(h.width, SPRING); hh.value = withSpring(h.height, SPRING);
      hr.value = withSpring(h.rx, SPRING);
    } else {
      // A centred card, or a target not yet measured: the hole closes to a point mid-screen.
      setHole(null);
      hx.value = withSpring(area.width / 2, SPRING); hy.value = withSpring(area.height / 2, SPRING);
      hw.value = withSpring(0, SPRING); hh.value = withSpring(0, SPRING);
    }
  }, [visibleRect, area, hx, hy, hw, hh, hr]);

  const holeProps = useAnimatedProps(() => ({ d: holePath(W.value, H.value, hx.value, hy.value, hw.value, hh.value, hr.value) }));
  const ringProps = useAnimatedProps(() => ({ x: hx.value - 3, y: hy.value - 3, width: hw.value + 6, height: hh.value + 6, rx: hr.value + 3, ry: hr.value + 3, opacity: hw.value > 0 ? 1 : 0 }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  // ── the card ──
  const [cardH, setCardH] = useState(180);
  const onCardLayout = (e: LayoutChangeEvent) => setCardH(e.nativeEvent.layout.height);
  const centred = !current?.target;
  const placed = hole ? placeCard(hole, cardH, area, insets) : null;
  const cardTop = useSharedValue(win.height / 2 - 90);
  useEffect(() => {
    const top = centred || !placed ? Math.max(insets.top + 24, (area.height - cardH) / 2) : placed.top;
    cardTop.value = withSpring(top, CARD_SPRING);
  }, [centred, placed?.top, cardH, area.height, insets.top, cardTop]);
  const cardStyle = useAnimatedStyle(() => ({ top: cardTop.value }));

  const spotSteps = steps.filter((s) => s.target).length;
  const spotIndex = steps.slice(0, step + 1).filter((s) => s.target).length;
  const waiting = !!current?.target && !visibleRect;
  // The first tour cannot be skipped (founder 2026-10-06); a replay can.
  const canSkip = !mandatory;

  if (!current) return null;

  return (
    <View ref={rootRef} collapsable={false} onLayout={measureRoot} style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Animated.View style={[StyleSheet.absoluteFill, dimStyle]}>
        <Svg width={area.width} height={area.height} style={StyleSheet.absoluteFill}>
          {/* The theme's dim plus a little black, filled once around the hole. */}
          <APath animatedProps={holeProps} fill={stackDim(colors.overlay, 0.28)} fillRule="evenodd" />
          <ARect animatedProps={ringProps} fill="none" stroke={colors.accent} strokeWidth={2.5} />
        </Svg>
        {/* Tapping the dim moves on — the quickest way through for someone who already knows. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => advance(1)} accessibilityLabel={t('tour.next')} />

        <Animated.View onLayout={onCardLayout} style={[{ position: 'absolute', left: spacing.lg, right: spacing.lg, paddingTop: narrated ? (centred ? ROSE_BIG : ROSE_SMALL) / 2 : 0 }, cardStyle]}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.md }}>
            {narrated ? (
              centred ? (
                // Her name under her portrait — she is the one speaking.
                <View style={{ alignItems: 'center', marginTop: ROSE_BIG / 2 - spacing.sm, marginBottom: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>{rose.name}</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textTertiary }}>{t('tour.narrator_role')}</Text>
                </View>
              ) : (
                <View style={{ marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: ROSE_SMALL / 2, paddingStart: ROSE_SMALL + spacing.sm, marginTop: -spacing.xs }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{rose.name}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
                    {Array.from({ length: spotSteps }).map((_, i) => (
                      <View key={i} style={{ height: 4, flex: i < spotIndex ? 1.6 : 1, borderRadius: 2, backgroundColor: i < spotIndex ? colors.accent : colors.border }} />
                    ))}
                  </View>
                </View>
              )
            ) : centred ? (
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
            <Text style={{ fontFamily: fonts.bold, fontSize: centred ? 22 : 17.5, lineHeight: centred ? 30 : 25, color: colors.textPrimary, textAlign: centred ? 'center' : 'right' }}>{t(current.title, { rose: rose.name })}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 23, color: colors.textSecondary, marginTop: 6, textAlign: centred ? 'center' : 'right' }}>{t(current.body, { rose: rose.name })}</Text>

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
            {(canSkip && (!last || current.href)) || (!canSkip && current.href) ? (
              <Pressable onPress={finish} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginTop: 2 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textTertiary }}>{t(current.href ? 'tour.later_short' : step === 0 ? 'tour.later' : 'tour.skip')}</Text>
              </Pressable>
            ) : null}
            {waiting ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: 4 }}>{t('tour.opening')}</Text> : null}
          </View>
          {narrated ? (
            // A full-width row does the placing (centre / start = the right in RTL); the portrait nods inside it.
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: centred ? 'center' : 'flex-start', paddingHorizontal: spacing.lg }}>
              <Animated.View style={[{ width: centred ? ROSE_BIG : ROSE_SMALL, height: centred ? ROSE_BIG : ROSE_SMALL }, nodStyle]}>
                <Image source={ROSE} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityLabel={rose.name} />
              </Animated.View>
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

