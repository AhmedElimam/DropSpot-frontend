const saved: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (k in saved ? saved[k] : null)),
    setItem: jest.fn(async (k: string, v: string) => { saved[k] = v; }),
  },
}));

import { useThemeStore, resolveScheme } from '../themeStore';
import { applyScheme, colors, currentScheme } from '@/theme/index';
import { dark, light } from '@/theme/palettes';

beforeEach(() => {
  for (const k of Object.keys(saved)) delete saved[k];
  applyScheme('light');
  useThemeStore.setState({ preference: 'system', scheme: 'light', hydrated: false, returnTo: null });
});

describe('resolveScheme', () => {
  it('follows the phone only on «system»', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});

describe('themeStore', () => {
  it('hydrates to the phone scheme when nothing is saved, and applies the live tokens', async () => {
    await useThemeStore.getState().hydrate('dark');
    expect(useThemeStore.getState()).toMatchObject({ preference: 'system', scheme: 'dark', hydrated: true });
    expect(currentScheme()).toBe('dark');
    expect(colors.background).toBe(dark.background);
  });

  it('hydrates to a saved explicit choice regardless of the phone', async () => {
    saved.theme_preference = 'light';
    await useThemeStore.getState().hydrate('dark');
    expect(useThemeStore.getState()).toMatchObject({ preference: 'light', scheme: 'light' });
    expect(colors.background).toBe(light.background);
  });

  it('ignores garbage in storage', async () => {
    saved.theme_preference = 'neon';
    await useThemeStore.getState().hydrate('light');
    expect(useThemeStore.getState().preference).toBe('system');
  });

  it('setPreference applies at once, persists, and remembers where it was flipped', async () => {
    await useThemeStore.getState().hydrate('light');
    await useThemeStore.getState().setPreference('dark', 'light', '/(teacher)/settings' as never);
    expect(useThemeStore.getState().scheme).toBe('dark');
    expect(colors.surface).toBe(dark.surface);
    expect(saved.theme_preference).toBe('dark');
    expect(useThemeStore.getState().peekReturnTo()).toBe('/(teacher)/settings');
  });

  it('the return route goes stale after a few seconds', async () => {
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
    await useThemeStore.getState().setPreference('dark', 'light', '/(parent)/profile' as never);
    expect(useThemeStore.getState().peekReturnTo()).toBe('/(parent)/profile');
    spy.mockReturnValue(now + 4001);
    expect(useThemeStore.getState().peekReturnTo()).toBeNull();
    spy.mockRestore();
  });

  it('a phone scheme change is followed on «system» and ignored on an explicit choice', async () => {
    await useThemeStore.getState().hydrate('light');
    useThemeStore.getState().systemChanged('dark');
    expect(useThemeStore.getState().scheme).toBe('dark');

    await useThemeStore.getState().setPreference('light', 'dark');
    useThemeStore.getState().systemChanged('dark');
    expect(useThemeStore.getState().scheme).toBe('light');
    expect(colors.background).toBe(light.background);
  });

  it('keeps working when storage is unavailable', async () => {
    const mod = jest.requireMock('@react-native-async-storage/async-storage').default;
    mod.getItem.mockRejectedValueOnce(new Error('keystore'));
    mod.setItem.mockRejectedValueOnce(new Error('keystore'));
    await useThemeStore.getState().hydrate('dark');
    expect(useThemeStore.getState().scheme).toBe('dark');
    await useThemeStore.getState().setPreference('light', 'dark');
    expect(useThemeStore.getState().scheme).toBe('light');
  });
});
