/**
 * The 60 Hz window cap for Android (plugins/withAndroidRefreshRateCap.js).
 *
 * A 120 Hz budget panel (Redmi 14C) drew the app at twice the frame rate of a 60 Hz phone
 * on a chip no faster, and was hot after minutes of ordinary use on the newest build. The
 * cap is injected into MainActivity.onCreate at prebuild, so it exists only in a native
 * build — which is why the RESOLVED plugin list is what this test reads, not app.json.
 */
import appJson from '../../../app.json';
import resolveConfig from '../../../app.config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { inject, MARKER } = require('../../../plugins/withAndroidRefreshRateCap');

type PluginEntry = string | [string, Record<string, any>?];
const resolved = resolveConfig({ config: appJson.expo as any, projectRoot: process.cwd(), staticConfigPath: null, packageJsonPath: null } as any);
const plugins = (resolved.plugins ?? []) as PluginEntry[];

// The SDK 54 Expo template's MainActivity.onCreate, as `expo prebuild` writes it.
const TEMPLATE = `class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"
}
`;

describe('Android 60 Hz window cap', () => {
  it('is in the resolved plugin list, capped at 60', () => {
    const entry = plugins.find((p) => Array.isArray(p) && p[0] === './plugins/withAndroidRefreshRateCap') as [string, { maxHz: number }] | undefined;
    expect(entry).toBeDefined();
    expect(entry![1].maxHz).toBe(60);
  });

  it('injects the cap right after super.onCreate, once', () => {
    const once = inject(TEMPLATE, 60);
    const twice = inject(once, 60);
    expect(twice).toBe(once);
    expect(once.split(MARKER).length - 1).toBe(1);
    expect(once.indexOf('super.onCreate(null)')).toBeLessThan(once.indexOf(MARKER));
    expect(once).toContain('val cap = 60.0f');
    expect(once).toContain('preferredDisplayModeId');
    expect(once).toContain('preferredMaxDisplayRefreshRate');
    // Still inside onCreate: the next method follows the inserted block.
    expect(once.indexOf(MARKER)).toBeLessThan(once.indexOf('getMainComponentName'));
  });

  it('refuses a template it does not recognise instead of silently shipping without the cap', () => {
    expect(() => inject('class MainActivity : ReactActivity() {}', 60)).toThrow(/onCreate not found/);
  });
});
