# iOS local credentials (for `eas build --profile production`)

Put your two Apple signing files here so EAS signs the App Store `.ipa` **without**
logging into Apple (sidesteps the locked Apple account). These files are gitignored —
never commit them.

Drop in EXACTLY these two files (match the names, or edit `credentials.json` paths):

1. `DrosSpot_Distribution.p12`
   - Your **iOS Distribution** certificate + private key, exported as `.p12`.
   - Export from Keychain Access → find **"Apple Distribution: … (24M2V9YQYH)"** →
     right-click → Export → `.p12` (set a password → put that password in
     `../../credentials.json`).

2. `DrosSpot_AppStore.mobileprovision`
   - An **App Store** distribution provisioning profile for `com.drosspot.app`,
     tied to that distribution certificate.
   - Download from developer.apple.com → Certificates, Identifiers & Profiles →
     **Profiles** → the App Store profile for `com.drosspot.app` (create one if none:
     type = App Store, App ID = com.drosspot.app, cert = the distribution cert above).
   - Must be **App Store** type (NOT Ad Hoc / Development) for TestFlight.

Then, from the project root:

```bash
eas build --platform ios --profile production
```

EAS reads `credentials.json`, uploads these files to the build, and signs with them —
no Apple login needed for the build.

NOTE: `eas submit` (uploading to TestFlight) still needs App Store Connect access —
use an App Store Connect **API key** (`.p8`) there, or Transporter, once the Apple
account is usable.

---

## Building the .ipa on GitHub Actions instead of EAS

`.github/workflows/ios-ipa.yml` builds a signed App Store `.ipa` on GitHub's macOS
runners (free — this repo is public) using these SAME two files, supplied as repo
secrets. Run these ONCE from the project root; they pipe the files straight into
`gh` so the key is never printed to a terminal, a log, or the shell history:

```bash
base64 -i credentials/ios/DrosSpot_Distribution.p12 | gh secret set IOS_DIST_P12_BASE64
base64 -i credentials/ios/drosspot_Profile.mobileprovision | gh secret set IOS_PROVISIONING_PROFILE_BASE64
gh secret set IOS_DIST_P12_PASSWORD   # paste the .p12 password when prompted
```

Then: **Actions → Build iOS IPA → Run workflow** (or push a `v*` tag to also attach
the `.ipa` to a GitHub Release). Download the `drosspot-ios-ipa` artifact and upload
it to App Store Connect with Transporter as usual.

The workflow regenerates `ios/` with `expo prebuild`, so it picks up `app.config.ts`
(static frameworks, RNFB `forceStaticLinking`, disable-SPM plugin) and the
`patch-package` patches automatically — no native files need committing. Each run
stamps `CFBundleVersion` with the GitHub run number, so App Store Connect never sees
a duplicate build number.

Renewal: the profile above expires **2027-08-31**. When it (or the certificate) is
replaced, re-run the matching `gh secret set` line — nothing else changes.
