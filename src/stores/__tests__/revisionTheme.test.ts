jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) },
}));

import { CURTAIN_IN_MS, LAND_IN_MS, useThemeStore } from '../themeStore';
import { applyScheme, colors, isRevisionTheme } from '@/theme/index';
import { light } from '@/theme/palettes';
import { REVISION_INK } from '@/theme/revision';

/**
 * The season switch in the store: silent at launch, the curtain on a flip, the screen that
 * flipped it remembered, and «off» = the palette exactly as it was.
 */
beforeEach(() => {
  jest.useFakeTimers();
  applyScheme('light');
  useThemeStore.getState().setRevision(false);
  useThemeStore.setState({ preference: 'system', scheme: 'light', hydrated: true, returnTo: null, paintEpoch: 0, curtain: null, revision: false, welcome: false });
});
afterEach(() => { jest.useRealTimers(); });

describe('themeStore.setRevision', () => {
  it('lands at once without animate, and re-keys the tree', () => {
    const before = useThemeStore.getState().paintEpoch;
    expect(useThemeStore.getState().setRevision(true)).toBe(true);
    expect(useThemeStore.getState()).toMatchObject({ revision: true, curtain: null, paintEpoch: before + 1 });
    expect(isRevisionTheme()).toBe(true);
    expect(colors.primary).toBe(REVISION_INK.indigo);
    expect(useThemeStore.getState().setRevision(true)).toBe(false); // idempotent, no re-key
    expect(useThemeStore.getState().paintEpoch).toBe(before + 1);
  });

  it('raises the curtain first, flips the tokens under it, then drops it', () => {
    const before = useThemeStore.getState().paintEpoch;
    useThemeStore.getState().setRevision(true, { animate: true, returnTo: '/settings' as never });
    expect(useThemeStore.getState().curtain).toMatchObject({ to: true });
    expect(useThemeStore.getState().revision).toBe(false);
    expect(colors.primary).toBe(light.primary);
    // Entering waits for the crest to assemble before the heavy rebuild (no stutter on it).
    jest.advanceTimersByTime(CURTAIN_IN_MS);
    expect(useThemeStore.getState().revision).toBe(false);
    jest.advanceTimersByTime(LAND_IN_MS - CURTAIN_IN_MS);
    expect(useThemeStore.getState()).toMatchObject({ revision: true, paintEpoch: before + 1 });
    expect(useThemeStore.getState().curtain).toMatchObject({ landed: before + 1 });
    expect(colors.primary).toBe(REVISION_INK.indigo);
    expect(useThemeStore.getState().peekReturnTo()).toBe('/settings');
    // The curtain stays up until the component says the new tree has painted.
    expect(useThemeStore.getState().curtain).not.toBeNull();
    useThemeStore.getState().curtainDone();
    expect(useThemeStore.getState().curtain).toBeNull();
  });

  it('welcomes the season once its curtain falls — only on the way in, never at launch', () => {
    useThemeStore.getState().setRevision(true);
    expect(useThemeStore.getState().welcome).toBe(false); // launch / restore: silent
    useThemeStore.getState().setRevision(false);
    useThemeStore.getState().setRevision(true, { animate: true });
    jest.advanceTimersByTime(LAND_IN_MS);
    expect(useThemeStore.getState().welcome).toBe(false); // not while the curtain is up
    useThemeStore.getState().curtainDone();
    expect(useThemeStore.getState().welcome).toBe(true);
    useThemeStore.getState().dismissWelcome();
    expect(useThemeStore.getState().welcome).toBe(false);
    // Leaving: no welcome, and one still open is closed by the flip.
    useThemeStore.setState({ welcome: true });
    useThemeStore.getState().setRevision(false, { animate: true });
    expect(useThemeStore.getState().welcome).toBe(false);
    jest.advanceTimersByTime(CURTAIN_IN_MS);
    useThemeStore.getState().curtainDone();
    expect(useThemeStore.getState().welcome).toBe(false);
  });

  it('uses the remembered screen when the flip arrives without one, once', () => {
    useThemeStore.getState().rememberReturn('/(teacher)/settings' as never);
    useThemeStore.getState().setRevision(true, { animate: true });
    jest.advanceTimersByTime(LAND_IN_MS);
    expect(useThemeStore.getState().peekReturnTo()).toBe('/(teacher)/settings');
    useThemeStore.getState().setRevision(false, { animate: true });
    jest.advanceTimersByTime(CURTAIN_IN_MS);
    expect(useThemeStore.getState().peekReturnTo()).toBeNull();
  });

  it('a second flip during the curtain replaces the first', () => {
    useThemeStore.getState().setRevision(true, { animate: true });
    jest.advanceTimersByTime(CURTAIN_IN_MS / 2);
    useThemeStore.getState().setRevision(false, { animate: true });
    jest.advanceTimersByTime(CURTAIN_IN_MS);
    expect(useThemeStore.getState().revision).toBe(false);
    expect(colors.primary).toBe(light.primary);
  });

  it('off = the palette exactly as before, whatever happened in between', () => {
    useThemeStore.getState().setRevision(true);
    applyScheme('dark');
    applyScheme('light');
    useThemeStore.getState().setRevision(false);
    expect({ ...colors }).toEqual(light);
  });
});
