import { CONFIG_DEFAULTS } from '@/config/defaults';

const mockSetItem = jest.fn(async () => {});
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: (...a: unknown[]) => mockSetItem(...(a as [])) },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAppConfigStore } = require('../appConfigStore') as typeof import('../appConfigStore');

const server = (flags: Record<string, boolean>) => ({ ...CONFIG_DEFAULTS, feature_flags: flags });

beforeEach(() => mockSetItem.mockClear());

describe('setConfig keeps what did not change', () => {
  it('the same answer again sets nothing and writes nothing — no re-render anywhere', () => {
    useAppConfigStore.getState().setConfig(server({ course_chat: false }));
    const first = useAppConfigStore.getState().config;
    expect(mockSetItem).toHaveBeenCalledTimes(1);

    useAppConfigStore.getState().setConfig(server({ course_chat: false }));
    expect(useAppConfigStore.getState().config).toBe(first);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
  });

  it('one flag changing keeps every other part as the same object', () => {
    useAppConfigStore.getState().setConfig(server({ course_chat: false, threads: false }));
    const before = useAppConfigStore.getState().config;
    useAppConfigStore.getState().setConfig(server({ course_chat: true, threads: false }));
    const after = useAppConfigStore.getState().config;
    expect(after).not.toBe(before);
    expect(after.feature_flags.course_chat).toBe(true);
    expect(after.ui).toBe(before.ui); // every <Surface> reads this — it must not churn
    expect(after.rules).toBe(before.rules);
  });

  it('a config changed elsewhere is never mistaken for the last answer', () => {
    useAppConfigStore.getState().setConfig(server({ course_chat: true }));
    useAppConfigStore.getState().resetUserFlags();
    useAppConfigStore.getState().setConfig(server({ course_chat: true }));
    expect(useAppConfigStore.getState().config.feature_flags.course_chat).toBe(true);
  });
});
