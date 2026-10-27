import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { RoseShield } from '@/components/rose/RoseStamp';
import { isRoseNotification, notificationLook } from '@/components/NotificationsFeed';
import { useAuthStore } from '@/stores/authStore';
import { getNotifications, markRead } from '@/api/notifications';
import { setupNotificationReceivedHandler } from '@/utils/push-notifications';
import { useInAppNotice, noticeIdOf, type InAppNotice } from './inAppNotice';

/** How long the toast stays before it slips away on its own (unread). */
const STAY_MS = 6000;
/** Below the home's header row, so the bell ringing above it stays in sight. */
const BELOW_HEADER = 72;
/** A poll-found notification is toasted only when it is this fresh — never an old unread one. */
const FRESH_MS = 5 * 60 * 1000;
const COUNT_KEY = ['notifications', 'unread-count'];

/**
 * Where a new notification shows while the app is open (founder 2026-10-27). Two sources:
 * a push that reaches the open app (its banner is held back, src/utils/push-notifications.ts),
 * and — for a phone without push permission — the bell's own count rising on its poll, when
 * the newest row is fresh. Mounted once at the root, for a signed-in account.
 */
export function InAppNoticeHost() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const qc = useQueryClient();

  // Source 1: a push while the app is in front.
  useEffect(() => {
    if (!isAuthenticated) return;
    const sub = setupNotificationReceivedHandler(({ title, body, data }) => {
      useInAppNotice.getState().show({ id: noticeIdOf(data), title, body, type: String(data?.type ?? ''), data }, true);
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => sub.remove();
  }, [isAuthenticated, qc]);

  // Source 2: the bell's count went up on a fetch (not on a swipe's optimistic patch).
  const last = useRef<number | null>(null);
  useEffect(() => {
    last.current = null; // a new account starts from its own count, never toasting what was already there
    if (!isAuthenticated) return;
    const cache = qc.getQueryCache();
    return cache.subscribe((e) => {
      if (e.type !== 'updated' || e.action.type !== 'success' || (e.action as { manual?: boolean }).manual) return;
      if (JSON.stringify(e.query.queryKey) !== JSON.stringify(COUNT_KEY)) return;
      const n = typeof e.action.data === 'number' ? e.action.data : null;
      if (n === null) return;
      const prev = last.current;
      last.current = n;
      if (prev === null || n <= prev) return;
      // A push already showed it a moment ago: the bell already shook.
      if (Date.now() - useInAppNotice.getState().lastPushAt < 15_000) return;
      void getNotifications({ page: 1, per_page: 1 }).then((rows) => {
        const top = rows[0];
        if (!top || top.is_read) return;
        const age = Date.now() - new Date(top.created_at).getTime();
        if (!(age >= -60_000 && age <= FRESH_MS)) { useInAppNotice.getState().pulse(); return; }
        useInAppNotice.getState().show({ id: top.id, title: top.title, body: top.body, type: top.type, data: top.data ?? {} });
      }).catch(() => { useInAppNotice.getState().pulse(); });
    });
  }, [isAuthenticated, userId, qc]);

  const notice = useInAppNotice((s) => s.notice);
  const pathname = usePathname() ?? '';
  // On the notifications page itself the list already shows it.
  const onFeed = pathname.endsWith('/notifications');
  // Arrived while the list was open: the list showed it — never toasted later on the way out.
  useEffect(() => { if (onFeed && notice) useInAppNotice.getState().clear(notice.key); }, [onFeed, notice]);
  if (!isAuthenticated || !notice || onFeed) return null;
  return <Toast key={notice.key} notice={notice} />;
}

function Toast({ notice }: { notice: InAppNotice }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const y = useSharedValue(-(insets.top + BELOW_HEADER + 120));
  const x = useSharedValue(0);
  const life = useSharedValue(1);
  const ex = useSharedValue(0); // 0 compact … 1 opened (the pull)
  const gone = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const leave = () => {
    if (gone.current) return;
    gone.current = true;
    if (timer.current) clearTimeout(timer.current);
    useInAppNotice.getState().clear(notice.key);
  };
  const slideOut = (toX = 0) => {
    'worklet';
    ex.value = withTiming(0, { duration: 180 });
    if (toX !== 0) {
      x.value = withTiming(toX, { duration: 220, easing: Easing.out(Easing.quad) }, (f) => { if (f) runOnJS(leave)(); });
    } else {
      y.value = withTiming(-(insets.top + BELOW_HEADER + 140), { duration: 260, easing: Easing.in(Easing.quad) }, (f) => { if (f) runOnJS(leave)(); });
    }
  };
  const arm = () => {
    if (timer.current) clearTimeout(timer.current);
    life.value = 1;
    life.value = withTiming(0, { duration: STAY_MS, easing: Easing.linear });
    timer.current = setTimeout(() => slideOut(0), STAY_MS);
  };
  // Opened: it stays until you choose — the clock stops.
  const expand = () => {
    if (timer.current) clearTimeout(timer.current);
    cancelAnimation(life);
    setOpen(true);
  };

  useEffect(() => {
    y.value = withSpring(0, { damping: 17, stiffness: 210, mass: 0.8 });
    arm();
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openIt = () => {
    const { open: go } = useInAppNotice.getState();
    if (notice.id !== null) {
      void markRead(notice.id).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {});
    }
    go?.(notice.data, notice.type);
    leave();
  };

  // Down: pull it open (part of the screen, the rest frosted behind). Up or sideways: away, UNREAD.
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      if (Math.abs(e.translationX) > Math.abs(e.translationY) * 1.2) { x.value = e.translationX; y.value = 0; return; }
      x.value = 0;
      if (e.translationY < 0) { y.value = e.translationY; return; }
      // Rubber band downwards; the frost follows the finger.
      y.value = Math.min(36, e.translationY * 0.35);
      if (!open) ex.value = Math.min(1, e.translationY / 110);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 90 || Math.abs(e.velocityX) > 700) { slideOut(e.translationX > 0 ? width : -width); return; }
      if (e.translationY < -30 || e.velocityY < -500) { slideOut(0); return; }
      y.value = withSpring(0, { damping: 18, stiffness: 240 });
      x.value = withSpring(0, { damping: 18, stiffness: 240 });
      if (e.translationY > 46 || e.velocityY > 500) {
        ex.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
        runOnJS(expand)();
      } else if (!open) {
        ex.value = withTiming(0, { duration: 160 });
      }
    });
  const tap = Gesture.Tap().maxDuration(400).onEnd((_e, ok) => { if (ok) runOnJS(openIt)(); });
  const gesture = Gesture.Exclusive(pan, tap);

  const cardSt = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(0.7, Math.abs(x.value) / (width * 0.9)),
    transform: [{ translateY: y.value }, { translateX: x.value }, { rotate: `${x.value / 70}deg` }, { scale: 1 + 0.02 * ex.value }],
  }));
  const frostSt = useAnimatedStyle(() => ({ opacity: ex.value }));
  const lifeSt = useAnimatedStyle(() => ({ transform: [{ scaleX: life.value }] }));
  // The buttons come in with the pull (no layout animation: docs/PERFORMANCE.md).
  const actionsSt = useAnimatedStyle(() => ({ opacity: ex.value }));

  const rose = isRoseNotification({ type: notice.type, data: notice.data });
  const look = notificationLook(notice.type);
  const ink = rose ? colors.accent : look.tint;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
      {/* The frost: the screen behind dims and cools while you pull, and stays while it is open.
          Tapping it puts the toast away, still unread. (A true blur needs a native module — a
          store build, not an OTA.) */}
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, frostSt]}>
        <TouchableWithoutFeedback onPress={() => slideOut(0)} accessibilityRole="button" accessibilityLabel={t('notifications.toast_later')}>
          <View style={StyleSheet.absoluteFill}>
            <LinearGradient colors={[colors.overlay, colors.overlayLight, colors.overlay]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, opacity: 0.18 }]} />
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel={`${notice.title}. ${notice.body}`}
          accessibilityHint={t('notifications.toast_hint')}
          style={[{
            position: 'absolute', top: insets.top + BELOW_HEADER, alignSelf: 'center',
            width: Math.min(width - spacing.lg * 2, 440), maxHeight: height * 0.5,
            backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
            overflow: 'hidden', ...shadows.md,
          }, cardSt]}
        >
          {/* A thin wash of the notification's colour along the top edge. */}
          <LinearGradient colors={[`${ink}22`, `${ink}00`]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40 }} pointerEvents="none" />
          <View style={{ flexDirection: 'row', alignItems: open ? 'flex-start' : 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: rose ? colors.surfaceSunken : `${look.tint}1F` }}>
              {rose ? <RoseShield size={27} /> : <Icon name={look.icon} size={18} color={look.tint} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 19, color: colors.textPrimary }}>{notice.title}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.textTertiary }}>{t('notifications.toast_now')}</Text>
              </View>
              {notice.body ? (
                <Text numberOfLines={open ? 12 : 1} style={{ fontFamily: fonts.regular, fontSize: open ? 14 : 12.5, lineHeight: open ? 22 : 17, color: colors.textSecondary, marginTop: 1 }}>{notice.body}</Text>
              ) : null}
            </View>
          </View>

          {open ? (
            <Animated.View style={[{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2 }, actionsSt]}>
              <TouchableOpacity onPress={openIt} activeOpacity={0.85} accessibilityRole="button"
                style={{ flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.onPrimary }}>{t('notifications.toast_open')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => slideOut(0)} activeOpacity={0.8} accessibilityRole="button"
                style={{ flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary }}>{t('notifications.toast_later')}</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            /* The handle says «pull me»; it is also the clock — it shortens until the toast slips away. */
            <View style={{ alignItems: 'center', paddingBottom: 6, marginTop: -2 }}>
              <View style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: colors.surfaceSunken, overflow: 'hidden' }}>
                <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: ink, opacity: 0.75 }, lifeSt]} />
              </View>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
