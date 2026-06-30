import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'دروس سبوت',
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
  },
  android: {
    package: 'com.drosspot.app',
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
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'يحتاج التطبيق إلى الوصول إلى موقعك لتسجيل الحضور',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'يحتاج التطبيق إلى الوصول إلى الكاميرا لمسح رمز QR',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    apiUrl: process.env.API_URL || 'http://localhost:8000/api/v1',
  },
});
