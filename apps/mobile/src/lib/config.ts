import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Адрес API:
 * 1) EXPO_PUBLIC_API_URL, если задан;
 * 2) в разработке — IP компьютера, на котором запущен Metro (телефон в той же Wi-Fi сети), порт 4000;
 * 3) эмулятор Android — 10.0.2.2, остальное — localhost.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const API_URL = resolveApiUrl();

/** Фото и тестовая страница оплаты приходят относительными путями — дополняем адресом API */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `${API_URL}${url}`;
}
