import type * as NotificationsTypes from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { registerDeviceToken, unregisterDeviceToken } from '@/api/device-tokens';

// @react-native-firebase is loaded LAZILY, inside the iOS branch below, never at module
// top. It is a native module: in Expo Go (or any build where it is missing/mis-linked)
// a top-level import throws while the module is being evaluated — and because this file
// is imported by the parent and teacher layouts, that single throw took down BOTH tab
// trees ("Route is missing the required default export"). Push is optional; the app is
// not. A missing native module now degrades to "no push", logged, and the app runs.
//
// Lazy was not enough on its own: the dynamic import still EVALUATED the module in Expo
// Go and threw "Native module RNFBAppModule not found" twice on every launch — caught,
// but printed as two red errors that look exactly like a real crash while debugging. Expo
// Go ships no custom native modules and (since SDK 53) no remote push at all, so there is
// nothing to gain by trying: the FCM path is skipped there before anything is imported.

/** Expo Go — no custom native modules, and no remote push since SDK 53. */
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Push failures are otherwise invisible — every bail-out below returns null. */
function pushLog(...args: unknown[]): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[push]', ...args);
  }
}

// expo-notifications itself is loaded LAZILY too, and never in Expo Go. Merely importing
// it runs its device-token auto-registration (DevicePushTokenAutoRegistration.fx), which in
// Expo Go on Android prints a red "remote notifications were removed from Expo Go" error on
// every launch — before any of our code decides to skip push. Nothing in the app schedules
// local notifications, so in Expo Go the module has no job at all and is not required.
type NotificationsModule = typeof NotificationsTypes;
let notificationsModule: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (IS_EXPO_GO) return null;
  if (notificationsModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      notificationsModule = require('expo-notifications') as NotificationsModule;
    } catch (e) {
      pushLog('expo-notifications unavailable in this build — push disabled', e);
      notificationsModule = null;
    }
  }
  return notificationsModule;
}

// Foreground presentation, installed once at load in every build that has the module.
notifications()?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android 8+ binds a notification's sound to its CHANNEL (not the payload), and a
// channel's sound is fixed at creation — so the custom tone lives on a fresh channel
// id here, which the backend targets via `channel_id`. iOS instead reads the sound
// straight off the APNs payload, so it needs no channel. notify_android.wav is bundled
// by the expo-notifications `sounds` config in app.config.ts.
export const ANDROID_CHANNEL_ID = 'drosspot-alerts';

async function ensureAndroidChannel(N: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await N.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'تنبيهات درس سبوت',
      importance: N.AndroidImportance.MAX,
      sound: 'notify_android.wav', // bundled name → res/raw; custom Android tone
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6D28D9',
    });
  } catch (e) {
    pushLog('android channel setup failed', e);
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (IS_EXPO_GO) {
    pushLog('skipped: Expo Go has no FCM native module — use a development build for push');
    return null;
  }

  const N = notifications();
  if (!N) return null;

  // Android emulators running a Google Play system image DO receive FCM, so only
  // the iOS Simulator is a hard stop here (no APNs).
  if (!Device.isDevice && Platform.OS !== 'android') {
    pushLog('skipped: iOS Simulator cannot receive remote push');
    return null;
  }

  const { status: existingStatus } = await N.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await N.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    pushLog('aborted: notification permission not granted, status =', finalStatus);
    return null;
  }

  // Create the custom-sound channel before any push can arrive (Android only).
  await ensureAndroidChannel(N);

  try {
    // The backend sends via Firebase Cloud Messaging directly (Kreait), so it needs a
    // native FCM registration token, NOT an Expo push token.
    let token: string;
    if (Platform.OS === 'ios') {
      // iOS: expo-notifications' getDevicePushTokenAsync returns an APNs token, which
      // direct-FCM can't target. @react-native-firebase registers the device with APNs
      // then hands back the real FCM token (Firebase forwards it to APNs via the uploaded
      // key/cert). Requires the Push capability + GoogleService-Info.plist.
      const [{ getApp }, { getMessaging, getToken, registerDeviceForRemoteMessages }] = await Promise.all([
        import('@react-native-firebase/app'),
        import('@react-native-firebase/messaging'),
      ]);
      const msg = getMessaging(getApp());
      await registerDeviceForRemoteMessages(msg);
      token = await getToken(msg);
    } else {
      // Android: expo-notifications returns the raw FCM registration token directly.
      const devicePushToken = await N.getDevicePushTokenAsync();
      token = String(devicePushToken.data);
    }

    const platform = Platform.OS;
    const deviceName = Device.deviceName ?? undefined;

    pushLog('got FCM token', `${token.slice(0, 12)}…`, '- registering with backend');
    await registerDeviceToken(token, platform, deviceName);
    pushLog('registered OK');

    return token;
  } catch (err: any) {
    // Distinguish the two very different failure modes: no token from the OS
    // (Expo Go on Android can't do remote push — needs a dev build), vs. the
    // backend rejecting the registration (wrong base URL, expired auth, 404).
    if (err?.isAxiosError) {
      pushLog(
        'backend rejected token registration:',
        err.response?.status ?? err.code,
        err.config?.baseURL ?? '',
        err.response?.data ?? err.message,
      );
    } else {
      pushLog('could not obtain a device push token:', err?.message ?? err);
    }
    return null;
  }
}

export async function unregisterPushNotifications(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await unregisterDeviceToken(token);
  } catch {
    // ignore
  }
}

export function setupNotificationResponseHandler(
  onNotificationResponse: (data: Record<string, unknown>) => void
): NotificationsTypes.EventSubscription {
  const N = notifications();
  if (!N) {
    // Expo Go, or a build without the module: nothing can arrive, so nothing to listen for.
    return { remove: () => {} };
  }
  return N.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    onNotificationResponse(data as Record<string, unknown>);
  });
}

/**
 * The push the user tapped to LAUNCH the app, if any. A tap on a closed app never reaches
 * the response listener above — it fires only for taps while the app is alive — so a
 * cold start has to ask for it once. Null in Expo Go, on a build without the module, or
 * when the app was opened from the icon.
 */
export async function getInitialNotificationResponse(): Promise<Record<string, unknown> | null> {
  const N = notifications();
  if (!N) return null;
  try {
    const response = await N.getLastNotificationResponseAsync();
    const data = response?.notification.request.content.data;
    return data ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
