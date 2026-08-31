const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo SDK 54 links pods as STATIC libraries, and @react-native-firebase v26's default
 * Swift-Package-Manager resolution of the Firebase iOS SDK is incompatible with static
 * linkage (duplicate-symbol errors). Setting `$RNFirebaseDisableSPM = true` (a Podfile
 * global that RNFirebase reads) switches Firebase back to CocoaPods resolution, which works
 * with static frameworks (see expo-build-properties ios.useFrameworks: 'static').
 *
 * The Podfile is regenerated on every prebuild, so we inject the global here (before the
 * first `target` block) via a dangerous mod that runs after the Podfile is written.
 */
module.exports = function withRNFirebaseDisableSPM(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes('$RNFirebaseDisableSPM')) {
        contents = contents.replace(
          /^target ['"].*$/m,
          (match) => `$RNFirebaseDisableSPM = true\n\n${match}`,
        );
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
};
