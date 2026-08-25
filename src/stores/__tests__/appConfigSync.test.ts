import i18n from '@/i18n';
import { CONFIG_DEFAULTS } from '@/config/defaults';

jest.mock('@/api/appConfig', () => ({ getAppConfig: jest.fn() }));
import { getAppConfig } from '@/api/appConfig';
import { syncAppConfig } from '../appConfigSync';
import { useAppConfigStore } from '../appConfigStore';

const mockGet = getAppConfig as jest.MockedFunction<typeof getAppConfig>;

afterEach(() => {
  useAppConfigStore.setState({ config: CONFIG_DEFAULTS });
  mockGet.mockReset();
});

describe('syncAppConfig', () => {
  it('applies server rules and overlays copy onto i18n', async () => {
    mockGet.mockResolvedValue({
      ...CONFIG_DEFAULTS,
      rules: { ...CONFIG_DEFAULTS.rules, geofence_max_accuracy_m: 35 },
      copy: { 'onboarding.getting_started_row': 'نص مُحدّث من الخادم' },
    });

    await syncAppConfig();

    expect(useAppConfigStore.getState().config.rules.geofence_max_accuracy_m).toBe(35);
    // Dotted copy key overrides the bundled string.
    expect(i18n.t('onboarding.getting_started_row')).toBe('نص مُحدّث من الخادم');
  });

  it('a failed fetch keeps last-good and never throws', async () => {
    // Seed a last-good value, then fail the next fetch.
    useAppConfigStore.getState().setConfig({ rules: { ...CONFIG_DEFAULTS.rules, geofence_max_accuracy_m: 42 } });
    mockGet.mockRejectedValue(new Error('network down'));

    await expect(syncAppConfig()).resolves.toBeUndefined();
    expect(useAppConfigStore.getState().config.rules.geofence_max_accuracy_m).toBe(42);
  });

  it('a missing server copy key falls back to the bundled string (no raw path)', async () => {
    mockGet.mockResolvedValue({ ...CONFIG_DEFAULTS, copy: {} });
    await syncAppConfig();
    // Not overridden → still the bundled value, never the literal key path.
    expect(i18n.t('common.logout')).not.toBe('common.logout');
  });
});
