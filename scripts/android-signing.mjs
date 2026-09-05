/**
 * Point the generated Android `release` build at the upload keystore.
 *
 * `expo prebuild` regenerates android/ on every CI run and signs `release` with the
 * DEBUG key, which Google Play rejects. This rewrites the freshly generated
 * build.gradle to add a `release` signingConfig reading its values from
 * gradle.properties (written by the workflow from repository secrets), so nothing
 * secret is ever committed.
 *
 * Run AFTER `expo prebuild`, from the project root:  node scripts/android-signing.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const GRADLE = 'android/app/build.gradle';
const src = readFileSync(GRADLE, 'utf8');

if (src.includes('signingConfigs.release')) {
  console.log('release signingConfig already present — nothing to do');
  process.exit(0);
}

const block = `        release {
            storeFile file(DROS_UPLOAD_STORE_FILE)
            storePassword DROS_UPLOAD_STORE_PASSWORD
            keyAlias DROS_UPLOAD_KEY_ALIAS
            keyPassword DROS_UPLOAD_KEY_PASSWORD
        }
`;

let out = src.replace(/(signingConfigs \{\r?\n)/, `$1${block}`);
if (out === src) {
  console.error('FAILED: no `signingConfigs {` block found in ' + GRADLE);
  process.exit(1);
}

// Expo's template ships `signingConfig signingConfigs.debug` inside buildTypes.release.
const before = out;
out = out.replace(
  /(buildTypes \{[\s\S]*?release \{[\s\S]*?signingConfig )signingConfigs\.debug/,
  '$1signingConfigs.release',
);
if (out === before) {
  console.error('FAILED: could not repoint buildTypes.release off the debug key');
  process.exit(1);
}

writeFileSync(GRADLE, out);
console.log('release buildType now signs with the upload keystore');
