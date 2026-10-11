import type { PaymentStartResponse } from '@kirilovskiy/shared';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { api } from '@/api/client';
import { absoluteUrl } from './config';

/**
 * Оплата заказа через платёжный адаптер:
 * API создаёт платёж → открываем страницу банка (или тестовую) в системном браузере →
 * банк возвращает клиента по deep link kirilovskiy://payment-result → проверяем статус.
 */
export async function payOrder(orderId: string, orderToken?: string): Promise<'opened' | 'cancelled'> {
  const returnUrl = Linking.createURL('payment-result', { queryParams: { orderId } });
  const payment = await api.post<PaymentStartResponse>(`/orders/${orderId}/pay`, { returnUrl }, { orderToken });
  const url = absoluteUrl(payment.confirmationUrl);
  if (!url) throw new Error('Платёжная страница недоступна. Попробуйте позже.');

  if (Platform.OS === 'web') {
    window.location.href = url;
    return 'opened';
  }

  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  // После возврата из браузера просим API перепроверить статус у банка
  await api.post(`/orders/${orderId}/payment/sync`, {}, { orderToken }).catch(() => undefined);
  return result.type === 'success' ? 'opened' : 'cancelled';
}
