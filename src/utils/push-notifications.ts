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
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: 'f537825e-3329-40d0-827a-aa708f228509',
    });

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
