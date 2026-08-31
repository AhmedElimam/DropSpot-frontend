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
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'drosspot',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.drosspot.app',
    supportsTablet: true,
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
  [
    'expo-build-properties',
    {
      android: {
        minSdkVersion: 24,
        ndkVersion: '30.0.14904198',
      },
      // Static frameworks for the CocoaPods Firebase iOS SDK (SPM is disabled below via
      // withRNFirebaseDisableSPM — v26's SPM path is incompatible with Expo's static linkage).
      ios: {
        useFrameworks: 'static',
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
  'expo-notifications',
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
          'يستخدم التطبيق الكاميرا لمسح رمز الحضور أو التحقق من الكارت.',
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
      // never records audio, so microphone stays removed.
      'expo-image-picker',
      {
        photosPermission:
          'يستخدم التطبيق صورك لإرفاق إثبات الدفع أو صورة الكارت عند الطلب.',
        cameraPermission:
          'يستخدم التطبيق الكاميرا لمسح رمز الحضور أو التحقق من الكارت.',
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 160,
        backgroundColor: '#FBFBFB',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 160,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.API_URL || 'http://localhost:8000/api/v1',
    eas: {
      projectId: 'f537825e-3329-40d0-827a-aa708f228509',
    },
  },
});

