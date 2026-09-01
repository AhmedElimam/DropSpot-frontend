const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Two Podfile tweaks required to build @react-native-firebase against Expo SDK 54's
 * STATIC pod linkage (expo-build-properties ios.useFrameworks: 'static'):
 *
 * 1. `$RNFirebaseDisableSPM = true` — RNFirebase's default Swift-Package-Manager
 *    resolution of the Firebase iOS SDK is incompatible with static linkage
 *    (duplicate symbols). This global switches Firebase back to CocoaPods, which
 *    works with static frameworks.
 *
 * 2. `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` on every pod
 *    target — under static frameworks RNFBApp is a framework module that includes
 *    non-modular React-Core headers (RCTConvert.h / RCTBridgeModule.h / …). Clang's
 *    -Werror,-Wnon-modular-include-in-framework-module turns that into a hard build
 *    failure; this build setting allows it (the standard RNFirebase + use_frameworks fix).
 *
 * The Podfile is regenerated on every prebuild, so both edits are injected here (after
 * the Podfile is written) and are idempotent.
 */
module.exports = function withRNFirebaseDisableSPM(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // (1) Disable SPM before the first target block.
      if (!contents.includes('$RNFirebaseDisableSPM')) {
        contents = contents.replace(
          /^target ['"].*$/m,
          (match) => `$RNFirebaseDisableSPM = true\n\n${match}`,
        );
      }

      // (2) Allow non-modular header includes on all pod targets, inside the existing
      //     `post_install do |installer|` block that the Expo/RN template always emits.
      if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        const snippet =
          '\n' +
          "    # RNFirebase + static frameworks: React-Core headers are included inside the\n" +
          "    # RNFBApp framework module; allow that so -Werror doesn't fail the build.\n" +
          "    installer.pods_project.targets.each do |target|\n" +
          '      target.build_configurations.each do |bc|\n' +
          "        bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'\n" +
          '      end\n' +
          '    end\n';
        if (/post_install do \|installer\|/.test(contents)) {
          contents = contents.replace(/post_install do \|installer\|\n/, (m) => m + snippet);
        } else {
          // Fallback: no post_install block found — append one before the final `end`.
          contents = contents.replace(/end\s*$/, `post_install do |installer|${snippet}end\n`);
        }
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
