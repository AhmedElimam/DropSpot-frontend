/**
 * Per-user feature flags (feature-targeting contract 2026-10-15): the config store resets
 * the person's flags on sign-out, refetches on sign-in / session switch, never applies an
 * answer that was requested for a previous session, and coalesces foreground refetches.
 */
import { CONFIG_DEFAULTS } from '@/config/defaults';

const disk: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (k in disk ? disk[k] : null)),
    setItem: jest.fn(async (k: string, v: string) => { disk[k] = v; }),
    removeItem: jest.fn(async (k: string) => { delete disk[k]; }),
  },
}));

const secure: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => (k in secure ? secure[k] : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => { secure[k] = v; }),
  deleteItemAsync: jest.fn(async (k: string) => { delete secure[k]; }),
}));

jest.mock('@/api/appConfig', () => ({ getAppConfig: jest.fn() }));
jest.mock('@/api/apiBase', () => ({
  ensureApiBaseHydrated: async () => {},
  getApiBaseOverride: () => null,
  setApiBaseOverride: async () => {},
}));
jest.mock('@/lib/errorReport', () => ({ setErrorReportingEnabled: () => {} }));

import { getAppConfig } from '@/api/appConfig';
import { mergeConfig, useAppConfigStore, isBetaFeature } from '../appConfigStore';
import { useAuthStore } from '../authStore';
import {
  syncAppConfig, syncAppConfigOnForeground, watchSessionForConfig, sessionStamp,
  FOREGROUND_CONFIG_GAP_MS, __resetSyncStateForTests,
} from '../appConfigSync';

const mockGet = getAppConfig as jest.MockedFunction<typeof getAppConfig>;
const TEACHER = { id: 7, user_type_id: 3, first_name: 'أحمد', last_name: 'محمد' } as never;
const ASSISTANT = { id: 9, user_type_id: 6, first_name: 'سارة', last_name: 'علي' } as never;

const payload = (over: Partial<typeof CONFIG_DEFAULTS>) => ({ ...CONFIG_DEFAULTS, ...over });
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

beforeEach(() => {
  for (const k of Object.keys(disk)) delete disk[k];
  for (const k of Object.keys(secure)) delete secure[k];
  mockGet.mockReset();
  __resetSyncStateForTests();
  useAppConfigStore.setState({ config: CONFIG_DEFAULTS });
  useAuthStore.setState({ user: null, role: null, activeTeacherId: null, impersonation: null, isAuthenticated: false, isLoading: false, switching: false });
});

describe('mergeConfig against today\'s server and the targeting server', () => {
  it('treats feature_beta / feature_flags_version as optional (an older server sends neither)', () => {
    const merged = mergeConfig({ feature_flags: { chat: true } });
    expect(merged.feature_flags).toEqual({ chat: true });
    expect(merged.feature_beta).toEqual([]);
    expect(merged.feature_flags_version).toBeUndefined();
  });

  it('carries the per-user beta keys and the version, dropping non-string junk', () => {
    const merged = mergeConfig({ feature_flags: { chat: true }, feature_beta: ['chat', 3 as never, null as never], feature_flags_version: 'ab12' });
    expect(merged.feature_beta).toEqual(['chat']);
    expect(merged.feature_flags_version).toBe('ab12');
  });

  it('keeps the backend-code manifest (ui.hidden) — a hidden surface must leave the screen', () => {
    const merged = mergeConfig({ ui: { hidden: ['tab.teacher.manage'] } as never });
    expect(merged.ui?.hidden).toEqual(['tab.teacher.manage']);
    // The sections the server left out keep their bundled defaults (validators stay).
    expect(merged.ui?.validation.egypt_phone).toEqual(CONFIG_DEFAULTS.ui!.validation.egypt_phone);
  });
});

describe('resetUserFlags', () => {
  it('drops the flags, the beta keys and the version — in memory and in the last-good cache', async () => {
    useAppConfigStore.getState().setConfig(payload({
      feature_flags: { chat: true, print_market: true }, feature_beta: ['chat'], feature_flags_version: 'v1',
      rules: { ...CONFIG_DEFAULTS.rules, geofence_max_accuracy_m: 33 },
    }));
    await flush();
    expect(isBetaFeature('chat')).toBe(true);
    expect(JSON.parse(disk['app_config.last_good']).feature_beta).toEqual(['chat']);

    useAppConfigStore.getState().resetUserFlags();
    await flush();

    const cfg = useAppConfigStore.getState().config;
    expect(cfg.feature_flags).toEqual({});
    expect(cfg.feature_beta).toEqual([]);
    expect(cfg.feature_flags_version).toBeUndefined();
    expect(isBetaFeature('chat')).toBe(false);
    // Platform-wide values stay.
    expect(cfg.rules.geofence_max_accuracy_m).toBe(33);
    // The next launch, before any fetch, starts from the same clean slate.
    const cached = JSON.parse(disk['app_config.last_good']);
    expect(cached.feature_flags).toEqual({});
    expect(cached.feature_beta).toEqual([]);
    expect(cached.rules.geofence_max_accuracy_m).toBe(33);
  });
});

describe('sessionStamp', () => {
  it('names the person, impersonation and the assistant\'s teacher context', () => {
    expect(sessionStamp()).toBe('anon');
    useAuthStore.setState({ user: TEACHER, role: 'teacher', isAuthenticated: true });
    expect(sessionStamp()).toBe('7:own:');
    useAuthStore.setState({ impersonation: { active: true, name: 'x', write: false } });
    expect(sessionStamp()).toBe('7:imp:');
    useAuthStore.setState({ user: ASSISTANT, role: 'assistant', impersonation: null, activeTeacherId: 7 });
    expect(sessionStamp()).toBe('9:own:7');
  });
});

describe('watchSessionForConfig', () => {
  let unwatch: () => void;
  beforeEach(() => { unwatch = watchSessionForConfig(); });
  afterEach(() => unwatch());

  it('sign-in refetches the per-user flags', async () => {
    mockGet.mockResolvedValue(payload({ feature_flags: { chat: true }, feature_beta: ['chat'] }));
    useAuthStore.setState({ user: TEACHER, role: 'teacher', isAuthenticated: true });
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(useAppConfigStore.getState().config.feature_beta).toEqual(['chat']);
  });

  it('re-setting the SAME session (a token refresh carrying the user) does not refetch', async () => {
    mockGet.mockResolvedValue(payload({}));
    useAuthStore.setState({ user: TEACHER, role: 'teacher', isAuthenticated: true });
    await flush();
    useAuthStore.setState({ user: { ...(TEACHER as object), needs_own_number_verification: false } as never, role: 'teacher', isAuthenticated: true });
    useAuthStore.setState({ switching: true });
    useAuthStore.setState({ switching: false });
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('sign-out resets the flags IMMEDIATELY, then fetches the global map anonymously', async () => {
    useAuthStore.setState({ user: TEACHER, role: 'teacher', isAuthenticated: true });
    mockGet.mockResolvedValue(payload({ feature_flags: { chat: true }, feature_beta: ['chat'], feature_flags_version: 'v1' }));
    await syncAppConfig();
    expect(useAppConfigStore.getState().config.feature_beta).toEqual(['chat']);

    // The anonymous answer is slow: the reset must not wait for it.
    let release!: (v: ReturnType<typeof payload>) => void;
    mockGet.mockReset();
    mockGet.mockImplementation(() => new Promise((r) => { release = r; }));
    useAuthStore.setState({ user: null, role: null, isAuthenticated: false });

    const now = useAppConfigStore.getState().config;
    expect(now.feature_flags).toEqual({});
    expect(now.feature_beta).toEqual([]);
    expect(now.feature_flags_version).toBeUndefined();
    // The anonymous request goes out right after (one microtask: the API-base hydration).
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(1);

    release(payload({ feature_flags: { released_everywhere: true }, feature_beta: [] }));
    await flush();
    expect(useAppConfigStore.getState().config.feature_flags).toEqual({ released_everywhere: true });
    expect(useAppConfigStore.getState().config.feature_beta).toEqual([]);
  });

  it('entering and leaving impersonation refetch each time', async () => {
    mockGet.mockResolvedValue(payload({}));
    useAuthStore.setState({ user: { id: 1, user_type_id: 1 } as never, role: 'admin', isAuthenticated: true });
    await flush();
    useAuthStore.setState({ user: TEACHER, role: 'teacher', impersonation: { active: true, name: 'أحمد', write: false } });
    await flush();
    useAuthStore.setState({ user: { id: 1, user_type_id: 1 } as never, role: 'admin', impersonation: null });
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('an assistant switching teacher context refetches', async () => {
    mockGet.mockResolvedValue(payload({}));
    useAuthStore.setState({ user: ASSISTANT, role: 'assistant', isAuthenticated: true, activeTeacherId: 7 });
    await flush();
    useAuthStore.setState({ activeTeacherId: 8 });
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('cold start: hydration handing back the persisted session is not a switch (one request, applied)', async () => {
    unwatch();
    useAuthStore.setState({ isLoading: true, user: null, isAuthenticated: false });
    expect(sessionStamp()).toBe('pending');
    unwatch = watchSessionForConfig();
    let release!: (v: ReturnType<typeof payload>) => void;
    mockGet.mockImplementation(() => new Promise((r) => { release = r; }));
    const run = syncAppConfig(); // the gate's start-up fetch, token already on disk
    await flush();
    // Auth hydration lands while the answer is in flight.
    useAuthStore.setState({ user: TEACHER, role: 'teacher', isAuthenticated: true, isLoading: false });
    await flush();
    release(payload({ feature_flags: { chat: true }, feature_beta: ['chat'] }));
    await run;
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(useAppConfigStore.getState().config.feature_beta).toEqual(['chat']);
  });

  it('cold start that finds NO session resets whatever the cache held', async () => {
    unwatch();
    useAppConfigStore.getState().setConfig(payload({ feature_flags: { chat: true }, feature_beta: ['chat'] }));
    useAuthStore.setState({ isLoading: true, user: null, isAuthenticated: false });
    unwatch = watchSessionForConfig();
    mockGet.mockResolvedValue(payload({}));
    useAuthStore.setState({ isLoading: false });
    expect(useAppConfigStore.getState().config.feature_beta).toEqual([]);
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('an answer requested for the previous person is never applied to the next one', async () => {
    const pending: Array<(v: ReturnType<typeof payload>) => void> = [];
    mockGet.mockImplementation(() => new Promise((r) => { pending.push(r); }));

    useAuthStore.setState({ user: TEACHER, role: 'teacher', isAuthenticated: true });
    await flush();
    expect(pending).toHaveLength(1);
    // The teacher signs out while their answer is still in flight; the assistant signs in.
    useAuthStore.setState({ user: null, role: null, isAuthenticated: false });
    useAuthStore.setState({ user: ASSISTANT, role: 'assistant', isAuthenticated: true });
    await flush();
    // Single-flight: the sign-out and sign-in joined the running fetch.
    expect(pending).toHaveLength(1);

    // The TEACHER's payload lands now — for a session that is gone.
    pending[0](payload({ feature_flags: { chat: true }, feature_beta: ['chat'] }));
    await flush();
    expect(useAppConfigStore.getState().config.feature_beta).toEqual([]);
    expect(useAppConfigStore.getState().config.feature_flags).toEqual({});
    // …and a fresh request went out for the assistant.
    expect(pending).toHaveLength(2);
    pending[1](payload({ feature_flags: { chat: false }, feature_beta: [] }));
    await flush();
    expect(useAppConfigStore.getState().config.feature_flags).toEqual({ chat: false });
  });
});

describe('syncAppConfigOnForeground', () => {
  it('coalesces: at most one refetch a minute, and none while one is running', async () => {
    let now = 1_000_000;
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      mockGet.mockResolvedValue(payload({}));
      expect(syncAppConfigOnForeground(now)).not.toBeNull();
      // Still running → nothing.
      expect(syncAppConfigOnForeground(now)).toBeNull();
      await flush();
      now += 20_000;
      expect(syncAppConfigOnForeground(now)).toBeNull();
      now += FOREGROUND_CONFIG_GAP_MS;
      expect(syncAppConfigOnForeground(now)).not.toBeNull();
      await flush();
      expect(mockGet).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('a session change is never throttled (it refetches right away)', async () => {
    const unwatch = watchSessionForConfig();
    try {
      mockGet.mockResolvedValue(payload({}));
      await syncAppConfig();
      useAuthStore.setState({ user: TEACHER, role: 'teacher', isAuthenticated: true });
      await flush();
      expect(mockGet).toHaveBeenCalledTimes(2);
    } finally {
      unwatch();
    }
  });
});
