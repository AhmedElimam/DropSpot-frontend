import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Text, TouchableOpacity, View, type AppStateStatus } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { StatusBar } from 'expo-status-bar';
import { router, type Href } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { radius, spacing } from '@/theme/index';
import { dark as night } from '@/theme/palettes';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { IS_STAGING, STAGING_HEADER, STAGING_KEY } from '@/config/env';
import { BUNDLED_API_URL } from '@/api/client';
import { getApiBaseOverride } from '@/api/apiBase';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { joinRemoteSessionAsStudent, joinRemoteSessionAsTeacher, remoteErrorCode, remoteErrorSentence } from '@/api/remoteSession';
import { refreshFamilyRemote, refreshTeacherRemote, teacherRoomKey } from '@/hooks/useRemoteSession';
import { binaryVersion } from '@/utils/binaryVersion';
import { useRoomAwake } from '@/remote/keepAwake';
import { isAllowedNavigation, isTrustedJoinUrl, mediaCaptureGrantFor, roomActionFor, roomDroppedAfter, ROOM_BACKGROUND_GRACE_MS, takeJoinUrl } from '@/remote/room';

/** Who is in the room: the teacher broadcasts; a student watches; a parent watches as their child. */
export type RoomRole = 'teacher' | 'student' | 'parent';

/** After the page has loaded, how long the cover waits for its «ready» before lifting anyway. */
const COVER_GRACE_MS = 4000;
/** How long «اتسجّل حضورك» stays up. */
const CHECKED_IN_PILL_MS = 5000;

const HOME: Record<RoomRole, Href> = {
  teacher: '/(teacher)/(tabs)' as Href,
  student: '/(student)/(tabs)' as Href,
  parent: '/(parent)/(tabs)' as Href,
};

type Stage =
  | { at: 'opening' }
  | { at: 'room'; url: string }
  | { at: 'error'; message: string; notLive: boolean };

/**
 * «حصة أونلاين» — the live room, full screen. The room is a web page served by our backend
 * (LiveKit inside, our own UI); this screen asks for a one-time `join_url` at the moment of
 * opening, shows it in a WebView and listens to what the page says (src/remote/room.ts).
 *
 * Light: no native media module, nothing polled, nothing animated. The WebView exists only
 * while this screen is in front — leave it, cover it, or put the app away for more than a few
 * seconds and it is unmounted, so the stream, the camera and the microphone stop with it.
 *
 * Secured: the link must sit on the app's own API origin, and the page can never take the
 * WebView anywhere else (every navigation, frame and redirect is checked against that origin).
 * A link is used once; every retry asks the server for a new one.
 */
export function RemoteRoomScreen({ role, sessionId, studentId }: { role: RoomRole; sessionId: string; studentId?: number | null }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const focused = useIsFocused();
  const [stage, setStage] = useState<Stage>({ at: 'opening' });
  /** Each bump opens a fresh room: a NEW join_url, a new WebView. */
  const [attempt, setAttempt] = useState(0);
  /** The app sat in the background past the grace: the room is dropped until it is back in front. */
  const [dropped, setDropped] = useState(false);
  /** The page's document finished loading. */
  const [loaded, setLoaded] = useState(false);
  /** The page said «ready» (loaded AND connected) — from then on it is trusted to show its own way out. */
  const [pageReady, setPageReady] = useState(false);
  /** The loading cover is lifted: on «ready», or a few seconds after the load at the latest. */
  const [coverUp, setCoverUp] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [pill, setPill] = useState(false);
  const closing = useRef(false);
  // Camera / microphone inside the page: granted on a build that can broadcast, denied in the
  // WebView itself on an older one (read once: the binary does not change under a screen).
  const [capture] = useState(() => mediaCaptureGrantFor(binaryVersion()));
  // The screen stays on while the class is on it — a broadcasting teacher's phone must not lock.
  useRoomAwake(focused && stage.at === 'room' && !dropped);

  const active = focused && !dropped;
  const viewerId = role === 'teacher' ? null : studentId ?? null;

  const refresh = useCallback(() => {
    if (role === 'teacher') refreshTeacherRemote(qc, sessionId);
    else refreshFamilyRemote(qc);
  }, [qc, role, sessionId]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    // The cards behind this screen show «مباشر الآن», the viewers and the attendance.
    refresh();
    if (router.canGoBack()) router.back();
    else router.replace(HOME[role]);
  }, [refresh, role]);

  // ── The link: asked for when the screen comes in front, again on every retry ──────────────
  useEffect(() => {
    setLoaded(false);
    setPageReady(false);
    setCoverUp(true);
    if (!active) {
      // Not in front: no WebView at all (and the link it had is spent anyway).
      setStage({ at: 'opening' });
      return;
    }
    let cancelled = false;
    setStage({ at: 'opening' });
    (async () => {
      try {
        let url: string;
        if (role === 'teacher') {
          // «start» already answered with the teacher's link; it waits in memory, used once.
          url = takeJoinUrl(teacherRoomKey(sessionId)) ?? await joinRemoteSessionAsTeacher(sessionId);
        } else {
          if (!viewerId) throw new Error('remote: no student');
          url = await joinRemoteSessionAsStudent(viewerId, sessionId);
        }
        if (cancelled) return;
        // Ours, or nothing: the link must be on the origin the API answers from.
        if (!isTrustedJoinUrl(url, getApiBaseOverride() ?? BUNDLED_API_URL)) throw new Error('remote: join_url is not on the API origin');
        setStage({ at: 'room', url });
      } catch (e) {
        if (cancelled) return;
        if (__DEV__) console.log('[remote] could not open the room', e);
        setStage({
          at: 'error',
          // The server's own sentence first; a network failure in the app's usual words; our own for the rest.
          message: remoteErrorSentence(e) ?? (isAxiosError(e) ? getFriendlyErrorMessage(e) : t('remote.error_body')),
          notLive: remoteErrorCode(e) === 'REMOTE_NOT_LIVE',
        });
      }
    })();
    return () => { cancelled = true; };
  }, [active, attempt, role, sessionId, viewerId, t]);

  // ── The background: a room is never kept alive behind the app ─────────────────────────────
  useEffect(() => {
    let leftAt: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let wasDropped = false;
    const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background') {
        if (leftAt === null) leftAt = Date.now();
        clear();
        // Android keeps JS timers running in the background: this is what stops the stream there.
        timer = setTimeout(() => { wasDropped = true; setDropped(true); }, ROOM_BACKGROUND_GRACE_MS);
      } else if (state === 'active') {
        clear();
        // iOS suspends JS (the timer above may never have fired): decide by the clock on return.
        const gone = leftAt !== null && roomDroppedAfter(Date.now() - leftAt);
        leftAt = null;
        if (wasDropped || gone) {
          // Back in front: a fresh room (a new link — the old one is spent).
          wasDropped = false;
          setDropped(false);
          setAttempt((n) => n + 1);
        }
      }
    });
    return () => { clear(); sub.remove(); };
  }, []);

  // ── The cover lifts on «ready», or a few seconds after the page loaded ────────────────────
  useEffect(() => {
    if (!loaded || !coverUp) return;
    const timer = setTimeout(() => setCoverUp(false), COVER_GRACE_MS);
    return () => clearTimeout(timer);
  }, [loaded, coverUp]);

  useEffect(() => {
    if (!pill) return;
    const timer = setTimeout(() => setPill(false), CHECKED_IN_PILL_MS);
    return () => clearTimeout(timer);
  }, [pill]);

  // ── Leaving ────────────────────────────────────────────────────────────────────────────────
  const inRoom = stage.at === 'room';
  const askLeave = useCallback(() => {
    // Nothing is running yet (still opening) or nothing can run (an error): just go.
    if (!inRoom) { close(); return; }
    const body = role === 'teacher' ? t('remote.leave_teacher_body')
      : role === 'student' ? t(checkedIn ? 'remote.leave_student_body_done' : 'remote.leave_student_body')
      : undefined;
    Alert.alert(t('remote.leave_title'), body, [
      { text: t('remote.leave_stay'), style: 'cancel' },
      { text: t('remote.leave_go'), onPress: close },
    ]);
  }, [checkedIn, close, inRoom, role, t]);

  // Android's hardware back asks first. (iOS has no swipe back here: the route turns the gesture off.)
  useEffect(() => {
    if (!focused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { askLeave(); return true; });
    return () => sub.remove();
  }, [askLeave, focused]);

  // ── What the page says ─────────────────────────────────────────────────────────────────────
  const roomUrl = stage.at === 'room' ? stage.url : null;
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    // Only our own page speaks to the app. (Navigation is already pinned to our origin; this
    // is the second check, on the address the message itself reports.)
    const from = e.nativeEvent.url;
    if (!roomUrl || (from && !isAllowedNavigation(from, roomUrl))) return;
    const action = roomActionFor(e.nativeEvent.data);
    if (!action) return;
    if (action.kind === 'ready') {
      setPageReady(true);
      setCoverUp(false);
    } else if (action.kind === 'close') {
      close();
    } else if (action.kind === 'ended') {
      close();
      // The one who ended it knows; everyone else is told.
      if (role !== 'teacher') Alert.alert(t('remote.ended_title'), t('remote.ended_body'));
    } else if (action.kind === 'checked_in') {
      // The home card and the attendance record now show «حاضر».
      refreshFamilyRemote(qc);
      if (role === 'student') {
        setCheckedIn(true);
        setPill(true);
      }
    }
  }, [close, qc, role, roomUrl, t]);

  const loadFailed = useCallback(() => {
    setStage({ at: 'error', message: t('remote.load_failed_body'), notLive: false });
  }, [t]);

  /** The page stays on our origin: any other address is refused before it loads. */
  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => !!roomUrl && isAllowedNavigation(req.url, roomUrl), [roomUrl]);
  /** Second line: if the WebView ever reports an address that is not ours, the room is torn down. */
  const onNavigation = useCallback((nav: WebViewNavigation) => {
    if (roomUrl && nav.url && !isAllowedNavigation(nav.url, roomUrl)) loadFailed();
  }, [loadFailed, roomUrl]);

  const source = useMemo(() => (roomUrl ? {
    uri: roomUrl,
    // The staging door (src/config/env.ts) — only a staging build has the key, and the link was
    // checked to be on the API's own origin before this header goes anywhere.
    ...(IS_STAGING && STAGING_KEY ? { headers: { [STAGING_HEADER]: STAGING_KEY } } : null),
  } : null), [roomUrl]);

  return (
    <View style={{ flex: 1, backgroundColor: night.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {focused ? <StatusBar style="light" /> : null}

      {/* Mounted only while the screen is in front (`active`), one WebView per link. */}
      {active && source ? (
        <WebView
          key={source.uri}
          source={source}
          style={{ flex: 1, backgroundColor: night.background }}
          containerStyle={{ flex: 1, backgroundColor: night.background }}
          // Navigation is decided in onShouldStartLoadWithRequest alone (same origin as the link,
          // src/remote/room.ts). The library's own whitelist is a PREFIX match and hands every
          // address it rejects to the system (Linking.openURL) — a page could then open the
          // browser or another app. With everything passed to our check, a refused address
          // goes nowhere at all.
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={onShouldStart}
          onNavigationStateChange={onNavigation}
          onMessage={onMessage}
          onLoadEnd={() => setLoaded(true)}
          onError={loadFailed}
          onHttpError={loadFailed}
          onContentProcessDidTerminate={loadFailed}
          onRenderProcessGone={loadFailed}
          // Live media.
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType={capture}
          allowsFullscreenVideo
          // One window, no way out of it.
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          allowsBackForwardNavigationGestures={false}
          allowsLinkPreview={false}
          allowFileAccess={false}
          mixedContentMode="never"
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          webviewDebuggingEnabled={__DEV__}
          // It is a room, not a document: no rubber band, no zoom, no pull to refresh.
          bounces={false}
          overScrollMode="never"
          pullToRefreshEnabled={false}
          setBuiltInZoomControls={false}
          textZoom={100}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        />
      ) : null}

      {/* Our own loading cover, until the page says it is ready. */}
      {stage.at !== 'error' && coverUp ? (
        // It takes the touches too: nothing under it can be pressed before it is seen.
        <View accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: night.background, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
          <BrandMark size={56} tint={night.onHero} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: night.textPrimary }}>{t('remote.opening')}</Text>
          <ActivityIndicator color={night.textSecondary} />
        </View>
      ) : null}

      {stage.at === 'error' ? (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: night.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: night.surface, borderWidth: 1, borderColor: night.border, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={stage.notLive ? 'video' : 'warning'} size={30} color={stage.notLive ? night.textSecondary : night.warningText} />
          </View>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 19, lineHeight: 28, color: night.textPrimary, textAlign: 'center' }}>
            {t(stage.notLive ? 'remote.not_live_title' : 'remote.error_title')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 23, color: night.textSecondary, textAlign: 'center' }}>{stage.message}</Text>
          <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md }}>
            {/* A retry always asks the server for a NEW link: the old one is spent. */}
            <TouchableOpacity onPress={() => setAttempt((n) => n + 1)} activeOpacity={0.85} accessibilityRole="button"
              style={{ minHeight: 52, borderRadius: radius.lg, backgroundColor: night.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
              <Icon name="refresh" size={18} color={night.onPrimary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: night.onPrimary }}>{t('remote.retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={close} activeOpacity={0.7} accessibilityRole="button"
              style={{ minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: night.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: night.textSecondary }}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Our own way out until the page has proven itself («ready»): opening, a slow load, a
          page that never connects. After that the page's own «leave» is the only chrome. */}
      {stage.at !== 'error' && !pageReady ? (
        <TouchableOpacity onPress={askLeave} accessibilityRole="button" accessibilityLabel={t('remote.leave_go')} hitSlop={10}
          style={{ position: 'absolute', top: insets.top + spacing.sm, start: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: night.surface, borderWidth: 1, borderColor: night.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={20} color={night.textPrimary} />
        </TouchableOpacity>
      ) : null}

      {/* «اتسجّل حضورك» — the system recorded it after enough watching. */}
      {pill ? (
        <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: insets.top + spacing.sm, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: night.success, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: spacing.lg }}>
            <Icon name="success" size={16} color={night.onPrimary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: night.onPrimary }}>{t('remote.checked_in')}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
