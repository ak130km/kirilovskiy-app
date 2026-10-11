import type { DeviceDto } from '@kirilovskiy/shared';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/api/client';
import { useSession } from '@/store/session';

// Показываем уведомления и когда приложение открыто
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function getPushPermission(): Promise<PushState> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  return status as PushState;
}

/**
 * Запрашивает разрешение (если ещё не спрашивали), получает Expo push-токен и регистрирует устройство в API.
 * Возвращает id устройства или null — заказ всё равно можно оформить, статус будет виден в приложении.
 *
 * Ограничения: на симуляторе push не работает; в Expo Go на Android push отключены с SDK 53 —
 * нужна development-сборка (npx expo run:android или eas build --profile development).
 */
export async function registerForPush(askPermission = true): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Статус заказа',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#b5654a',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && askPermission) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] Не задан EAS projectId (EAS_PROJECT_ID) — push-токен не получен');
      return null;
    }
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    const device = await api.post<DeviceDto>('/devices', {
      expoPushToken,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    });
    useSession.getState().setDeviceId(device.id);
    return device.id;
  } catch (e) {
    console.warn('[push] Регистрация не удалась', e);
    return useSession.getState().deviceId;
  }
}
