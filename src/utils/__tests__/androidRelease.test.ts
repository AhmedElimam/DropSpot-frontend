/**
 * The Android release build must be R8-optimised (shrunk, optimised, OBFUSCATED).
 *
 * Google Play flagged release 1.2.2 for "DEX code optimisation below threshold —
 * Obfuscation 1%", a state that can limit the listing's visibility. The cause was not a
 * missing setting but a setting in the wrong file: app.json carried an R8 switch, and
 * app.config.ts — which spreads app.json and then REPLACES `plugins` wholesale — threw it
 * away. Nothing in app.json's plugin list reaches a build.
 *
 * So this test asserts against the RESOLVED config, the way `expo prebuild` sees it,
 * rather than against either file's text.
 */
import appJson from '../../../app.json';
import resolveConfig from '../../../app.config';

type PluginEntry = string | [string, Record<string, any>?];

const resolved = resolveConfig({ config: appJson.expo as any, projectRoot: process.cwd(), staticConfigPath: null, packageJsonPath: null } as any);
const plugins = (resolved.plugins ?? []) as PluginEntry[];

function pluginProps(name: string): Record<string, any> | undefined {
  const entry = plugins.find((p) => (Array.isArray(p) ? p[0] : p) === name);
  return Array.isArray(entry) ? entry[1] : undefined;
}

describe('Android release optimisation (Google Play DEX check)', () => {
  const buildProps = pluginProps('expo-build-properties');

  it('declares expo-build-properties exactly once in the RESOLVED plugin list', () => {
    const count = plugins.filter((p) => (Array.isArray(p) ? p[0] : p) === 'expo-build-properties').length;
    expect(count).toBe(1);
  });

  it('turns R8 on for release builds, under the SDK-54 key the Gradle template reads', () => {
    expect(buildProps?.android?.enableMinifyInReleaseBuilds).toBe(true);
  });

  it('shrinks unused resources alongside R8 (pointless without it, wasteful without this)', () => {
    expect(buildProps?.android?.enableShrinkResourcesInReleaseBuilds).toBe(true);
  });

  // `enableProguardInReleaseBuilds` was the SDK-53 spelling. expo-build-properties 1.x
  // silently ignores it, so its presence would mean someone believed R8 was on when it
  // was not — the exact mistake this file exists to catch.
  it('does not carry the retired SDK-53 key anywhere', () => {
    expect(buildProps?.android).not.toHaveProperty('enableProguardInReleaseBuilds');
    expect(JSON.stringify(appJson)).not.toContain('enableProguardInReleaseBuilds');
  });

  // The failure mode this guards: app.json grows a plugin entry that nobody notices is dead.
  it('app.json declares no plugin that app.config.ts does not also declare', () => {
    const names = (entries: PluginEntry[]) => entries.map((p) => (Array.isArray(p) ? p[0] : p));
    const live = new Set(names(plugins));
    for (const name of names(appJson.expo.plugins as PluginEntry[])) {
      expect(live.has(name)).toBe(true);
    }
  });
});
