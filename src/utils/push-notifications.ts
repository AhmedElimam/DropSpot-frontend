import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, getToken, registerDeviceForRemoteMessages } from '@react-native-firebase/messaging';
import { registerDeviceToken, unregisterDeviceToken } from '@/api/device-tokens';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Push failures are otherwise invisible — every bail-out below returns null. */
function pushLog(...args: unknown[]): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[push]', ...args);
  }
}

// Android 8+ binds a notification's sound to its CHANNEL (not the payload), and a
// channel's sound is fixed at creation — so the custom tone lives on a fresh channel
// id here, which the backend targets via `channel_id`. iOS instead reads the sound
// straight off the APNs payload, so it needs no channel. notify_android.wav is bundled
// by the expo-notifications `sounds` config in app.config.ts.
export const ANDROID_CHANNEL_ID = 'drosspot-alerts';

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'تنبيهات درس سبوت',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'notify_android.wav', // bundled name → res/raw; custom Android tone
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6D28D9',
    });
  } catch (e) {
    pushLog('android channel setup failed', e);
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  // Android emulators running a Google Play system image DO receive FCM, so only
  // the iOS Simulator is a hard stop here (no APNs).
  if (!Device.isDevice && Platform.OS !== 'android') {
    pushLog('skipped: iOS Simulator cannot receive remote push');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    pushLog('aborted: notification permission not granted, status =', finalStatus);
    return null;
  }

  // Create the custom-sound channel before any push can arrive (Android only).
  await ensureAndroidChannel();

  try {
    // The backend sends via Firebase Cloud Messaging directly (Kreait), so it needs a
    // native FCM registration token, NOT an Expo push token.
    let token: string;
    if (Platform.OS === 'ios') {
      // iOS: expo-notifications' getDevicePushTokenAsync returns an APNs token, which
      // direct-FCM can't target. @react-native-firebase registers the device with APNs
      // then hands back the real FCM token (Firebase forwards it to APNs via the uploaded
      // key/cert). Requires the Push capability + GoogleService-Info.plist.
      const msg = getMessaging(getApp());
      await registerDeviceForRemoteMessages(msg);
      token = await getToken(msg);
    } else {
      // Android: expo-notifications returns the raw FCM registration token directly.
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
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
): Notifications.EventSubscription {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    onNotificationResponse(data as Record<string, unknown>);
  });
  return subscription;
}
