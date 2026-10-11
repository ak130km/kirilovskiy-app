import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryKeys } from '@/api/hooks';
import { registerForPush } from '@/lib/notifications';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Нажатие на push «Заказ готов» открывает экран заказа; новые уведомления обновляют данные */
function useNotificationRouting(client: QueryClient) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (data: Record<string, unknown> | undefined) => {
      const orderId = typeof data?.orderId === 'string' ? data.orderId : null;
      if (orderId) router.push(`/order/${orderId}`);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data);

    const tapSub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    const receiveSub = Notifications.addNotificationReceivedListener((n) => {
      const orderId = n.request.content.data?.orderId;
      if (typeof orderId === 'string') void client.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      void client.invalidateQueries({ queryKey: queryKeys.orders });
    });
    return () => {
      tapSub.remove();
      receiveSub.remove();
    };
  }, [client]);
}

export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );
  const hydrated = useSession((s) => s.hydrated);
  const token = useSession((s) => s.token);

  useNotificationRouting(client);

  useEffect(() => {
    if (!hydrated) return;
    void SplashScreen.hideAsync().catch(() => undefined);
    // Обновляем привязку push-токена (без повторного запроса разрешения)
    void registerForPush(false);
  }, [hydrated, token]);

  if (!hydrated) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Главная' }} />
          <Stack.Screen name="category/[slug]" options={{ title: '' }} />
          <Stack.Screen name="product/[id]" options={{ title: '' }} />
          <Stack.Screen name="checkout" options={{ title: 'Оформление заказа' }} />
          <Stack.Screen name="order/[id]" options={{ title: 'Заказ' }} />
          <Stack.Screen name="payment-result" options={{ title: 'Оплата', headerBackVisible: false }} />
          <Stack.Screen name="auth/phone" options={{ title: 'Вход', presentation: 'modal' }} />
          <Stack.Screen name="auth/code" options={{ title: 'Код из SMS', presentation: 'modal' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
