import { ConfigContext, ExpoConfig } from 'expo/config';

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
    icon: './assets/expo.icon',
    supportsTablet: true,
    // App uses only standard/exempt encryption (HTTPS) — declaring this avoids
    // EAS prompting (and crashing) on ITSAppUsesNonExemptEncryption at build.
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.drosspot.app',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
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
    },
  ],
  'expo-router',
  'expo-sqlite',
  'expo-secure-store',
  'expo-notifications',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'ÙŠØ­ØªØ§Ø¬ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø¥Ù„Ù‰ Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ù…ÙˆÙ‚Ø¹Ùƒ Ù„ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø­Ø¶ÙˆØ±',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'ÙŠØ­ØªØ§Ø¬ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø¥Ù„Ù‰ Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„ÙƒØ§Ù…ÙŠØ±Ø§ Ù„Ù…Ø³Ø­ Ø±Ù…Ø² QR',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#6366F1',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
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

