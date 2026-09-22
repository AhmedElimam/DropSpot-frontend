import { ConfigContext, ExpoConfig } from 'expo/config';
import { existsSync } from 'fs';
import { resolve } from 'path';

// iOS Firebase config. Wire GoogleService-Info.plist ONLY when the file is actually present,
// so builds (incl. the Android APK) don't break while iOS Firebase is still being set up.
// Drop `GoogleService-Info.plist` at the project root (next to google-services.json) to activate.
const iosGoogleServices = existsSync(resolve(__dirname, 'GoogleService-Info.plist'))
  ? { googleServicesFile: './GoogleService-Info.plist' }
  : {};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'DrosSpot',
  slug: 'DrosSpot',
  // ONE place to bump the version: app.json → expo.version. Both CI workflows read it
  // from there too, so Android and iOS can never ship different version names.
  version: config.version ?? '0.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'drosspot',
  // LIGHT-ONLY, deliberately. The app ships a single palette (src/theme) with no dark
  // variants, so 'automatic' was a lie: it left AppCompat in MODE_NIGHT_FOLLOW_SYSTEM,
  // and expo-system-ui then paints the ROOT VIEW Color.BLACK on a device in dark mode —
  // which is the black seen behind the splash logo while JS boots. MODE_NIGHT_NO keeps
  // it white. Revisit only when a real dark palette exists.
  userInterfaceStyle: 'light',
  // Explicit window/root background so it can never fall back to a night-mode default.
  // Matches the splash background below (one continuous colour from launch to first paint).
  backgroundColor: '#FBFBFB',
  ios: {
    bundleIdentifier: 'com.drosspot.app',
    // App Store Connect rejects a re-used build number. CI stamps the run number via
    // IOS_BUILD_NUMBER, but never BELOW the floor in app.json — a workflow's run counter
    // is independent of what App Store Connect has already seen (and resets if the file
    // is renamed), so the floor is what guarantees the number only ever goes up.
    buildNumber: String(Math.max(
      parseInt(process.env.IOS_BUILD_NUMBER || '0', 10) || 0,
      parseInt((config.ios?.buildNumber as string) || '1', 10) || 1,
    )),
    // iPhone-only — we don't support iPad, so don't declare tablet support (otherwise
    // App Store Connect demands iPad screenshots / capabilities).
    supportsTablet: false,
    // App uses only standard/exempt encryption (HTTPS) — declaring this avoids
    // EAS prompting (and crashing) on ITSAppUsesNonExemptEncryption at build.
    config: {
      usesNonExemptEncryption: false,
    },
    // Present only once GoogleService-Info.plist exists (see the const above).
    ...iosGoogleServices,
  },
  android: {
    package: 'com.drosspot.app',
    // Google Play refuses a versionCode it has already accepted. CI stamps the run
    // number (ANDROID_VERSION_CODE), exactly as iOS gets IOS_BUILD_NUMBER — never lower
    // than the floor in app.json, so a local build can't go backwards either.
    versionCode: Math.max(
      parseInt(process.env.ANDROID_VERSION_CODE || '0', 10) || 0,
      config.android?.versionCode ?? 1,
    ),
    googleServicesFile: './google-services.json',
    // Resize the screen when the keyboard opens so scroll/bottom-anchored content
    // is never hidden behind it (Modals additionally wrap in KeyboardAvoidingView).
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      // Flat near-white ground (matches the iOS icon); the pin mark is the foreground.
      backgroundColor: '#FBFBFB',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
  // RTL must be set NATIVELY, before JS runs. `I18nManager.forceRTL(true)` in
  // app/_layout.tsx only takes effect after a relaunch on iOS, so a FIRST launch on a
  // clean install renders with a left-to-right native layout while every screen is
  // written for right-to-left — which is what an App Store reviewer gets, and nobody
  // here ever sees, because our devices have all been relaunched. This plugin writes
  // ExpoLocalization_forcesRTL into Info.plist / strings.xml so the very first launch
  // is already RTL. (App Store rejection 2026-09-04, iPad Air M3.)
  [
    'expo-localization',
    {
      supportsRTL: true,
      forcesRTL: true,
    },
  ],
  [
    'expo-build-properties',
    {
      android: {
        minSdkVersion: 24,
        ndkVersion: '30.0.14904198',
        // R8 in release builds: shrink, optimise and OBFUSCATE the Java/Kotlin side.
        // Google Play flagged release 1.2.2 ("DEX code optimisation below threshold —
        // Obfuscation 1%"), which can limit the listing's visibility. The switch had been
        // set in app.json, but THIS file replaces `plugins` wholesale (see the note above
        // `extra`), so it never reached a build; and app.json used the SDK-53 key name,
        // which the SDK-54 Gradle template no longer reads. This is the only place that
        // counts. R8 also drops the unreferenced native code every linked library carries
        // (the release-stub dev launcher included), which is a smaller DEX to load on the
        // low-end Android devices the app has felt heavy on (assistants + Play Console,
        // 2026-09-22: slow, hot, memory).
        // Every native dependency ships its own consumer keep rules; RN's own rules keep
        // the @ReactProp/@ReactMethod/@DoNotStrip members it reaches by reflection, so no
        // project rules are needed. Add `extraProguardRules` here only for a REPRODUCED
        // release-build failure — each blanket -keep lowers the obfuscation score.
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
      },
      // Static frameworks for the CocoaPods Firebase iOS SDK (SPM is disabled below via
      // withRNFirebaseDisableSPM — RNFirebase's SPM path is incompatible with Expo's static linkage).
      ios: {
        useFrameworks: 'static',
        // Force the RNFirebase BRIDGING pods to link as plain STATIC LIBRARIES rather than
        // clang framework modules. As framework modules they compile ObjC categories on
        // RCTConvert and use RCT_EXTERN/RCTPromiseRejectBlock from NON-modular React-Core
        // headers, which fails under useFrameworks:'static' with "non-modular header inside
        // framework module 'RNFBApp…'" and "'RCTConvert' must be imported from module before
        // required". Linking them statically drops the module wrapper so React headers compile
        // textually as normal. (Expo SDK 54+ prebuilt-core Podfile reads ios.forceStaticLinking.)
        forceStaticLinking: ['RNFBApp', 'RNFBMessaging'],
      },
    },
  ],
  // Native Firebase — provides an FCM token on iOS (expo-notifications only yields an
  // APNs token there, which our direct-FCM backend can't target). Reads GoogleService-Info.plist.
  // withRNFirebaseDisableSPM MUST come before the RNFirebase plugins so the Podfile global is set.
  './plugins/withRNFirebaseDisableSPM',
  '@react-native-firebase/app',
  '@react-native-firebase/messaging',
  'expo-router',
  'expo-sqlite',
  'expo-secure-store',
  // Bundle the custom notification tones into BOTH platforms (iOS app bundle +
  // Android res/raw). iOS references notify_ios by filename in the APNs payload;
  // Android plays notify_android via the 'drosspot-alerts' channel (push-notifications.ts).
  [
    'expo-notifications',
    {
      sounds: ['./assets/sounds/notify_ios.wav', './assets/sounds/notify_android.wav'],
    },
  ],
    [
      'expo-location',
      {
        // Shown on the OS prompt AND read by App Store review. Must be plain Arabic
        // (the app is when-in-use only; both keys carry the same justification).
        locationWhenInUsePermission:
          'يستخدم التطبيق موقعك للتأكد من حضورك الفعلي في مكان الحصة عند تسجيل الحضور.',
        locationAlwaysAndWhenInUsePermission:
          'يستخدم التطبيق موقعك للتأكد من حضورك الفعلي في مكان الحصة عند تسجيل الحضور.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'يستخدم التطبيق الكاميرا لمسح رمز الحضور أو التحقق من الكارت، وليسجّل المعلم فيديو إجابة قصيرًا في النقاشات.',
        // Recording a thread answer needs sound. Same string as the chat recorder so the
        // OS prompt reads the same wherever the mic is first asked for.
        microphonePermission:
          'يستخدم التطبيق الميكروفون لتسجيل رسالة صوتية في دردشة المقرر أو فيديو إجابة في النقاشات.',
      },
    ],
    [
      // Payment-proof + card-order photo uploads. Set the photo-library string
      // (a used, review-visible permission). NOTE: cameraPermission MUST NOT be
      // `false` here — that makes this plugin emit `tools:node="remove"` for
      // android.permission.CAMERA, which STRIPS the permission expo-camera needs,
      // so the Android camera prompt never appears and the scanner is dead. Give it
      // the SAME justified Arabic string as expo-camera so CAMERA stays declared and
      // the iOS usage string is consistent regardless of plugin order. The picker
      // microphonePermission used to be `false` here, which — exactly like the camera
      // case above — emits tools:node="remove" for RECORD_AUDIO and would strip the
      // permission the chat voice recorder (expo-audio) needs. Same justified string.
      'expo-image-picker',
      {
        photosPermission:
          'يستخدم التطبيق صورك لإرفاق إثبات الدفع أو صورة الكارت، أو لإرسال صورة في دردشة المقرر.',
        cameraPermission:
          'يستخدم التطبيق الكاميرا لمسح رمز الحضور أو التحقق من الكارت.',
        microphonePermission:
          'يستخدم التطبيق الميكروفون لتسجيل رسالة صوتية في دردشة المقرر.',
      },
    ],
    [
      // Course chat voice notes (recorder + player). The mic string is shown on the OS
      // prompt and read by store review; the recorder is only reachable from a room.
      'expo-audio',
      {
        microphonePermission:
          'يستخدم التطبيق الميكروفون لتسجيل رسالة صوتية في دردشة المقرر.',
      },
    ],
    // Thread answers as short video: the teacher records with expo-camera (already linked),
    // students play with expo-video. expo-video needs its plugin for the Android media
    // session / iOS background-audio entitlements it declares; no permission strings.
    'expo-video',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 160,
        backgroundColor: '#FBFBFB',
        // The dark variant is declared for ANDROID ONLY, on purpose. A cross-platform
        // `dark` block makes expo-splash-screen force iOS to UIUserInterfaceStyle
        // "Automatic", which quietly cancels `userInterfaceStyle: 'light'` above — and a
        // light-only app following a dark-mode iPad renders unstyled TextInputs as white
        // text on our near-white ground. Android needs its variant to pin
        // values-night/colors.xml against OEM forced-dark; iOS does not.
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 160,
          dark: {
            image: './assets/images/splash-icon.png',
            backgroundColor: '#FBFBFB',
          },
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Dead-man switch identity (App\Support\AppRelease reads it as X-App-Id). This key
    // lives in app.json too, but THIS file's `extra` replaces that object wholesale, so
    // it has to be restated here or resolveAppId() loses its level-2 fallback.
    appId: 'com.drosspot.app',
    apiUrl: process.env.API_URL || 'http://localhost:8000/api/v1',
    eas: {
      projectId: 'f537825e-3329-40d0-827a-aa708f228509',
    },
  },
});

