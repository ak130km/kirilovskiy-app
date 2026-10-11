import type { ConfigContext, ExpoConfig } from 'expo/config';

const BRAND = '#b5654a';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Кондитерская Кирилловского',
  slug: 'kirilovskiy-bakery',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'kirilovskiy',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'ru.kirilovskiy.bakery',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'ru.kirilovskiy.bakery',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: BRAND,
    },
    // Разрешение на уведомления (Android 13+) запрашивает expo-notifications
    permissions: [],
  },
  web: {
    output: 'single',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-image',
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#fbf6f1',
        image: './assets/splash-icon.png',
        imageWidth: 160,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: BRAND,
        defaultChannel: 'orders',
      },
    ],
  ],
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
