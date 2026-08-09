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

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
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

    await registerDeviceToken(token, platform, deviceName);

    return token;
  } catch {
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
