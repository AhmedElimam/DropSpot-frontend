/**
 * Every role layout registers for push on mount AND on every foreground, so a phone that
 * opens the app ten times a day POSTed ten identical registrations — a radio wake-up each.
 * The server is told only when the token or the user changes, or once a day.
 */
const storage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => storage[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => { storage[k] = v; }),
    removeItem: jest.fn(async (k: string) => { delete storage[k]; }),
  },
}));
jest.mock('expo-device', () => ({ isDevice: true, deviceName: 'Redmi' }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone', expoConfig: {} },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
let mockToken = 'fcm-token-1';
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getDevicePushTokenAsync: jest.fn(async () => ({ data: mockToken })),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));
const mockRegister = jest.fn(async (..._a: unknown[]) => {});
const mockUnregister = jest.fn(async (..._a: unknown[]) => {});
jest.mock('@/api/device-tokens', () => ({
  registerDeviceToken: (...a: unknown[]) => mockRegister(...a),
  unregisterDeviceToken: (...a: unknown[]) => mockUnregister(...a),
}));
let mockUserId = 7;
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: mockUserId } }) },
}));

import { registerForPushNotifications, unregisterPushNotifications, _resetRegistrationMemo } from '../push-notifications';

beforeEach(() => {
  for (const k of Object.keys(storage)) delete storage[k];
  mockRegister.mockClear();
  mockToken = 'fcm-token-1';
  mockUserId = 7;
  _resetRegistrationMemo();
});

describe('push registration is sent once, not on every foreground', () => {
  it('registers on the first call and skips the repeats', async () => {
    expect(await registerForPushNotifications()).toBe('fcm-token-1');
    await registerForPushNotifications(); // app resumed
    await registerForPushNotifications(); // and again
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('survives a cold start through storage', async () => {
    await registerForPushNotifications();
    _resetRegistrationMemo(); // a new process reads the persisted stamp
    await registerForPushNotifications();
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('re-registers when the token rotates, the user changes, or a day has passed', async () => {
    await registerForPushNotifications();
    mockToken = 'fcm-token-2';
    await registerForPushNotifications();
    expect(mockRegister).toHaveBeenCalledTimes(2);

    mockUserId = 8; // another account signed in on the same phone
    await registerForPushNotifications();
    expect(mockRegister).toHaveBeenCalledTimes(3);

    const stored = JSON.parse(storage.push_registration);
    storage.push_registration = JSON.stringify({ ...stored, at: Date.now() - 25 * 60 * 60 * 1000 });
    _resetRegistrationMemo();
    await registerForPushNotifications();
    expect(mockRegister).toHaveBeenCalledTimes(4);
  });

  it('forgets a registration that failed or was withdrawn', async () => {
    mockRegister.mockRejectedValueOnce(new Error('500'));
    expect(await registerForPushNotifications()).toBeNull();
    await registerForPushNotifications();
    expect(mockRegister).toHaveBeenCalledTimes(2);

    await unregisterPushNotifications('fcm-token-1');
    expect(mockUnregister).toHaveBeenCalledWith('fcm-token-1');
    await registerForPushNotifications();
    expect(mockRegister).toHaveBeenCalledTimes(3);
  });
});
