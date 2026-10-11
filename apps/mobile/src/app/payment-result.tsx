import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { api } from '@/api/client';
import { Loader } from '@/components/ui';
import { useSession } from '@/store/session';

/** Сюда возвращает банк (deep link kirilovskiy://payment-result?orderId=…). Проверяем оплату и открываем заказ. */
export default function PaymentResultScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string; status?: string }>();
  const orderToken = useSession((s) => (orderId ? s.orderToken(orderId) : undefined));

  useEffect(() => {
    if (!orderId) {
      router.replace('/');
      return;
    }
    api
      .post(`/orders/${orderId}/payment/sync`, {}, { orderToken })
      .catch(() => undefined)
      .finally(() => router.replace(`/order/${orderId}`));
  }, [orderId, orderToken]);

  return <Loader />;
}
