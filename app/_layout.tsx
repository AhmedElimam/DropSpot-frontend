import '../src/i18n';
import { I18nManager, View, ActivityIndicator, Text, TextInput, AppState, type AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { enableFreeze } from 'react-native-screens';
import NetInfo from '@react-native-community/netinfo';

// Hidden tab screens stop rendering. Every role's detail screens are registered as
// `href: null` TAB routes (30 of them for a teacher), so each one visited in a session
// stays mounted and kept re-rendering on every data change while invisible — CPU, heat
// and memory that grew with the session (Play Console 2026-09-22: memory + performance;
// founder: "slow routing"). With freeze on, an unfocused screen keeps its state but
// renders nothing until it is shown again. `freezeOnBlur` is set per navigator.
enableFreeze(true);

// NetInfo's reachability probe runs an HTTP request to a Google endpoint on a timer:
// with the library's DEFAULTS that is every 60s while online and every **5 SECONDS**
// while offline, forever. On a weak Egyptian cellular link the phone therefore spends
// its time waking the radio to a high-power state and failing, which is battery and
// heat with no user-visible benefit (Redmi Note 11S reports, 2026-09-22). Nothing in
// the app needs sub-minute reachability: the offline banner and the scan buffer both
// tolerate a slower signal, and a real request failing is what actually drives them.
NetInfo.configure({
  reachabilityLongTimeout: 5 * 60 * 1000,
  reachabilityShortTimeout: 60 * 1000,
  reachabilityRequestTimeout: 10 * 1000,
});
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { SurveyModal } from '@/components/SurveyModal';
import { TeacherOnboardingModal } from '@/components/TeacherOnboardingModal';
import { AppConfigGate } from '@/components/AppConfigGate';
import { colors } from '@/theme/index';

// RTL is now set natively at build time by the expo-localization plugin (see
// app.config.ts), so the first launch on a clean install is already right-to-left.
// These calls stay for older installs that were built before that plugin existed —
// on those the flag persists and applies from the next launch, as it always did.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// Respect the OS accessibility font size, but cap it so fixed-height layouts
// (gradient headers, stat tiles) don't clip at extreme multipliers.
type TextWithDefaults = typeof Text & { defaultProps?: { maxFontSizeMultiplier?: number } };
(Text as TextWithDefaults).defaultProps = {
  ...(Text as TextWithDefaults).defaultProps,
  maxFontSizeMultiplier: 1.3,
};
(TextInput as TextWithDefaults).defaultProps = {
  ...(TextInput as TextWithDefaults).defaultProps,
  maxFontSizeMultiplier: 1.3,
};

// Never let a rejected promise here become an unhandled rejection at startup.
SplashScreen.preventAutoHideAsync().catch(() => {});

// React Query had NO app-state integration, and that is a battery and heat bug, not a
// tuning preference. Its "is the app in the foreground?" check is a browser concept; with
// nothing wired, `focusManager` answers TRUE FOREVER on a phone. So every `refetchInterval`
// in the app — the unread badge every 30s, sessions and the today feed every 60s — kept
// firing while the app sat in the user's POCKET, waking the cellular radio around the
// clock. `refetchIntervalInBackground` defaults to false and was doing nothing, because
// the app never reported itself backgrounded. Wiring AppState makes that default work:
// polling stops on background and resumes on foreground.
AppState.addEventListener('change', (status: AppStateStatus) => {
  focusManager.setFocused(status === 'active');
});

// NOT wired on purpose: `onlineManager`. Telling React Query when the device is offline
// would make it PAUSE queries and mutations instead of letting them run and fail — and
// this app has 141 mutations plus a door-scanning flow whose whole offline design is
// built on a request failing (the scanner buffers from its own `useOfflineStore` flag,
// and screens surface an error the user can act on). Pausing them would turn a clear
// failure into a spinner that never resolves, in exactly the patchy-signal venues where
// the app is used. The radio saving is already taken by NetInfo.configure above.

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cold starts on Android/Samsung (process killed in the background, slow
      // first cellular request) intermittently failed the very first fetch and
      // dropped straight to the reload screen. Retry a little harder with a
      // capped exponential backoff so a transient first-request blip recovers on
      // its own instead of showing an error the user has to tap through.
      // ...but never retry an auth failure. A 401/403 will not become a 200 by asking
      // again: the session is over (an impersonation token, for one, cannot be renewed at
      // all). Retrying held the screen on a spinner through the full 2s/4s/8s backoff —
      // per query, several at once — before the app finally admitted it was signed out.
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) return false;

        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30000,
    },
  },
});

function HydrationGate({ children }: { children: React.ReactNode }) {
  const isLoading = useAuthStore((s) => s.isLoading);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [hydrationStarted, setHydrationStarted] = useState(false);

  useEffect(() => {
    if (!hydrationStarted) {
      setHydrationStarted(true);
      hydrate();
    }
  }, [hydrate, hydrationStarted]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Cairo-Regular': require('../assets/fonts/Cairo-Regular.ttf'),
    'Cairo-Medium': require('../assets/fonts/Cairo-Medium.ttf'),
    'Cairo-Bold': require('../assets/fonts/Cairo-Bold.ttf'),
  });

  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    if (fontError) {
      console.warn('Font loading error:', fontError);
    }
  }, [fontError]);

  // Hide on fonts loaded OR on a font error — the old condition checked only
  // `fontsLoaded`, so a font that failed to load left the splash on screen forever
  // with a fully rendered, completely untouchable app underneath it.
  useEffect(() => {
    if ((fontsLoaded || fontError) && !splashHidden) {
      SplashScreen.hideAsync().catch(() => {});
      setSplashHidden(true);
    }
  }, [fontsLoaded, fontError, splashHidden]);

  // Last-resort release. Whatever goes wrong above, the splash comes down after five
  // seconds: a visibly broken app can be reported, an invisible one just looks frozen.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashHidden((already) => {
        if (!already) { SplashScreen.hideAsync().catch(() => {}); }
        return true;
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Once the fallback timer has fired, render regardless — with system fonts if it
  // comes to that. Returning null here after hiding the splash would leave a blank
  // white screen, which is the same failure wearing a different colour.
  if (!fontsLoaded && !fontError && !splashHidden) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <HydrationGate>
          <AppConfigGate>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Persistent impersonation banner sits above every screen. */}
            <ImpersonationBanner />
            <View style={{ flex: 1 }}>
              {/* A consistent content background so screen transitions never flash the
                  navigator's default (white) card between two routes. */}
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
            </View>
            {/* Super-admin survey prompt — checked on app-open/login, once across platforms. */}
            <SurveyModal />
            {/* Teacher onboarding — Step 1 intro popup for a brand-new teacher. */}
            <TeacherOnboardingModal />
          </View>
          </AppConfigGate>
        </HydrationGate>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}