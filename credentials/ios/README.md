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
