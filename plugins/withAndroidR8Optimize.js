const { withAppBuildGradle, withGradleProperties, WarningAggregator } = require('expo/config-plugins');

/**
 * R8 in OPTIMISING mode for Android release builds (older-device heat, 2026-09-27).
 *
 * expo-build-properties already turns R8 on (enableMinifyInReleaseBuilds), which shrinks and
 * obfuscates. But the Gradle template Expo generates hands R8 Android's
 * `proguard-android.txt`, which carries `-dontoptimize`: no inlining, no class merging, no
 * dead-branch removal. Google Play flagged exactly that on release 1.2.3 ("Optimisation isn't
 * enabled"), and it is DEX the low-end phones load and JIT on every launch.
 *
 * Two edits, both re-applied on every `expo prebuild` (android/ is gitignored and regenerated
 * in CI, so hand-editing build.gradle would be lost):
 *
 * 1. app/build.gradle: `proguard-android.txt` → `proguard-android-optimize.txt`.
 * 2. gradle.properties: `android.r8.optimizedResourceShrinking=true` — R8 shrinks resources
 *    together with code (Play's second item; the default from AGP 9).
 *
 * RISK, stated: the optimising pass can remove or merge code that a library reaches only by
 * reflection. React Native and every native dependency ship consumer keep rules for that, but
 * a release build MUST be installed and exercised (login, scan, pay, push, PDF) before it goes
 * to Play — the android-apk workflow builds exactly that APK. If something breaks, add a
 * targeted `extraProguardRules` keep in expo-build-properties rather than removing this plugin.
 *
 * If a future Expo template no longer contains the line, this WARNS at prebuild instead of
 * failing the release build; src/utils/__tests__/androidRelease.test.ts keeps the plugin wired.
 */
const DEFAULT_RULES = 'getDefaultProguardFile("proguard-android.txt")';
const OPTIMIZE_RULES = 'getDefaultProguardFile("proguard-android-optimize.txt")';
const RESOURCE_SHRINKING_KEY = 'android.r8.optimizedResourceShrinking';

function withOptimizeRules(config) {
  return withAppBuildGradle(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (src.includes(OPTIMIZE_RULES)) return cfg;
    if (!src.includes(DEFAULT_RULES)) {
      WarningAggregator.addWarningAndroid(
        'withAndroidR8Optimize',
        `app/build.gradle no longer contains ${DEFAULT_RULES}; R8 optimisation was NOT enabled. Update plugins/withAndroidR8Optimize.js.`,
      );
      return cfg;
    }
    cfg.modResults.contents = src.split(DEFAULT_RULES).join(OPTIMIZE_RULES);
    return cfg;
  });
}

function withOptimizedResourceShrinking(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((item) => !(item.type === 'property' && item.key === RESOURCE_SHRINKING_KEY));
    cfg.modResults.push({ type: 'property', key: RESOURCE_SHRINKING_KEY, value: 'true' });
    return cfg;
  });
}

module.exports = function withAndroidR8Optimize(config) {
  return withOptimizedResourceShrinking(withOptimizeRules(config));
};

module.exports.DEFAULT_RULES = DEFAULT_RULES;
module.exports.OPTIMIZE_RULES = OPTIMIZE_RULES;
module.exports.RESOURCE_SHRINKING_KEY = RESOURCE_SHRINKING_KEY;
