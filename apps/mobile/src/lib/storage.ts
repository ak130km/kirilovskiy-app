import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Секреты (токен клиента) — в Keychain/Keystore; на вебе — в localStorage */
export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return Platform.OS === 'web' ? await AsyncStorage.getItem(key) : await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string | null): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (value === null) await AsyncStorage.removeItem(key);
        else await AsyncStorage.setItem(key, value);
      } else if (value === null) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch {
      /* хранилище недоступно */
    }
  },
};
