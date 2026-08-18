import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
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

  try {
    // Native device push token — on Android this is the raw FCM registration
    // token. The backend sends via Firebase Cloud Messaging directly (Kreait), so
    // it needs the native FCM token, NOT an Expo push token.
    // NOTE (iOS): this returns an APNs token, which direct-FCM can't target as-is —
    // iOS push needs the FCM token via @react-native-firebase/messaging (or the
    // Expo push service). Android is functional now; iOS is a follow-up.
    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    const token = String(devicePushToken.data);

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
