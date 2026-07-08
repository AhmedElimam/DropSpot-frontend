import client from './client';

export async function registerDeviceToken(
  token: string,
  platform?: string,
  deviceName?: string
): Promise<void> {
  await client.post('/device-tokens', {
    token,
    platform,
    device_name: deviceName,
  });
}

export async function unregisterDeviceToken(token: string): Promise<void> {
  await client.delete(`/device-tokens/${encodeURIComponent(token)}`);
}
