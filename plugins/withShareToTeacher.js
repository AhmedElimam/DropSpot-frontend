const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

/**
 * «Share the receipt to the teacher» (founder 2026-11-11), Android half.
 *
 * A parent pays in InstaPay or Vodafone Cash, taps share, and the share sheet lists the
 * teachers they still owe, each with name and logo, the way it lists WhatsApp chats. Tapping
 * one opens Dros Spot with the receipt and that teacher already chosen.
 *
 * Android needs two things in the build, both written here because `android/` is regenerated
 * by prebuild on every CI build:
 *  - MainActivity accepts ACTION_SEND of an image or text (the app itself in the share sheet).
 *  - A `share-target` (res/xml/drosspot_share_targets.xml, referenced from the activity's
 *    `android.app.shortcuts` meta-data) binding the category the native module publishes its
 *    teacher shortcuts under — that is what makes them contacts in the sheet. Android 6–9 read
 *    them through androidx.sharetarget's ChooserTargetService, declared alongside.
 *
 * The teachers themselves are published at run time (modules/drosspot-share): only those a
 * family owes by transfer.
 */
const CATEGORY = 'com.drosspot.share.TEACHER_RECEIPT'; // = DrosspotShareModule.CATEGORY
const XML_NAME = 'drosspot_share_targets';
const MIME_TYPES = ['image/*', 'text/plain'];

function shareTargetsXml(activityClass) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by plugins/withShareToTeacher.js — do not edit by hand. -->
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <share-target android:targetClass="${activityClass}">
${MIME_TYPES.map((m) => `    <data android:mimeType="${m}" />`).join('\n')}
    <category android:name="${CATEGORY}" />
  </share-target>
</shortcuts>
`;
}

function mainActivity(manifest) {
  const app = manifest.manifest.application?.[0];
  return (app?.activity ?? []).find((a) => a.$['android:name'] === '.MainActivity');
}

const withManifest = (config) => withAndroidManifest(config, (cfg) => {
  const activity = mainActivity(cfg.modResults);
  if (!activity) throw new Error('withShareToTeacher: .MainActivity not found in AndroidManifest');

  activity['intent-filter'] = activity['intent-filter'] ?? [];
  const already = activity['intent-filter'].some((f) => (f.action ?? []).some((a) => a.$['android:name'] === 'android.intent.action.SEND'));
  if (!already) {
    activity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: MIME_TYPES.map((m) => ({ $: { 'android:mimeType': m } })),
    });
  }

  activity['meta-data'] = (activity['meta-data'] ?? []).filter((m) =>
    m.$['android:name'] !== 'android.app.shortcuts' && m.$['android:name'] !== 'android.service.chooser.chooser_target_service');
  activity['meta-data'].push(
    { $: { 'android:name': 'android.app.shortcuts', 'android:resource': `@xml/${XML_NAME}` } },
    { $: { 'android:name': 'android.service.chooser.chooser_target_service', 'android:value': 'androidx.sharetarget.ChooserTargetServiceCompat' } },
  );
  return cfg;
});

const withXml = (config) => withDangerousMod(config, ['android', async (cfg) => {
  const pkg = cfg.android?.package;
  if (!pkg) throw new Error('withShareToTeacher: android.package is required');
  const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${XML_NAME}.xml`), shareTargetsXml(`${pkg}.MainActivity`));
  return cfg;
}]);

module.exports = function withShareToTeacher(config) {
  return withXml(withManifest(config));
};
