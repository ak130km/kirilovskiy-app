import type { OrderStatus } from '@kirilovskiy/shared';
import {
  formatDateRu,
  formatDateTimeMsk,
  formatPhone,
  formatRub,
  formatSlot,
  getCustomerStatusSteps,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@kirilovskiy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorText } from '@/api/client';
import { queryKeys, useOrder, useStoreInfo } from '@/api/hooks';
import { Button, Card, ErrorView, Loader, Notice, Row, StatusBadge } from '@/components/ui';
import { absoluteUrl } from '@/lib/config';
import { payOrder } from '@/lib/payment';
import { repeatOrder } from '@/lib/reorder';
import { useSession } from '@/store/session';
import { colors, font, radius, space } from '@/theme';

const STATUS_HINTS: Record<OrderStatus, string> = {
  NEW: 'Заказ принят в систему. Как только оплата пройдёт, кондитерская подтвердит его.',
  CONFIRMED: 'Кондитерская подтвердила заказ и начнёт готовить его к нужному времени.',
  PREPARING: 'Кондитеры готовят ваши десерты.',
  READY: 'Заказ готов!',
  HANDED_TO_COURIER: 'Курьер уже везёт заказ.',
  COMPLETED: 'Заказ выполнен. Приятного аппетита!',
  CANCELLED: 'Заказ отменён.',
};

const STATUS_ICONS: Record<OrderStatus, keyof typeof Ionicons.glyphMap> = {
  NEW: 'hourglass-outline',
  CONFIRMED: 'checkmark-done-outline',
  PREPARING: 'flame-outline',
  READY: 'gift-outline',
  HANDED_TO_COURIER: 'bicycle-outline',
  COMPLETED: 'heart-outline',
  CANCELLED: 'close-circle-outline',
};

function alert(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export default function OrderScreen() {
  const { id, autopay } = useLocalSearchParams<{ id: string; autopay?: string }>();
  const { data: order, isLoading, isError, error, refetch, isRefetching } = useOrder(id);
  const store = useStoreInfo();
  const token = useSession((s) => s.orderToken(id));
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const autopayDone = useRef(false);

  async function pay() {
    setPaying(true);
    try {
      await payOrder(id, token);
    } catch (e) {
      alert('Оплата не началась', errorText(e));
    } finally {
      setPaying(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    }
  }

  // Сразу после оформления открываем оплату
  useEffect(() => {
    if (autopay === '1' && order?.canPay && !autopayDone.current) {
      autopayDone.current = true;
      router.setParams({ autopay: undefined });
      void pay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopay, order?.canPay]);

  async function repeat() {
    setRepeating(true);
    try {
      const res = await repeatOrder(id);
      if (res.unavailable.length) {
        alert('Не всё есть в наличии', `Сейчас недоступны: ${res.unavailable.join(', ')}. Остальное — в корзине.`);
      }
      router.navigate('/cart');
    } catch (e) {
      alert('Не получилось', errorText(e));
    } finally {
      setRepeating(false);
    }
  }

  if (isLoading) return <Loader />;
  if (isError || !order) return <ErrorView message={error?.message ?? 'Заказ не найден'} onRetry={() => refetch()} />;

  const steps = getCustomerStatusSteps(order.fulfillmentType);
  const currentIndex = steps.indexOf(order.status);
  const reachedAt = (s: OrderStatus) => order.history.find((h) => h.toStatus === s)?.createdAt;
  const isCancelled = order.status === 'CANCELLED';
  const address = [order.address, order.apartment && `кв. ${order.apartment}`, order.entrance && `подъезд ${order.entrance}`, order.floor && `этаж ${order.floor}`]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Stack.Screen options={{ title: `Заказ № ${order.number}` }} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
      >
        <View style={[styles.hero, isCancelled && { backgroundColor: colors.dangerSoft }]}>
          <View style={[styles.heroIcon, isCancelled && { backgroundColor: colors.danger }]}>
            <Ionicons name={STATUS_ICONS[order.status]} size={30} color={colors.white} />
          </View>
          <Text style={styles.heroTitle}>{ORDER_STATUS_LABELS[order.status]}</Text>
          <Text style={styles.heroText}>
            {order.status === 'NEW' && order.paymentStatus === 'SUCCEEDED'
              ? 'Оплата получена. Кондитерская скоро подтвердит заказ — мы пришлём уведомление.'
              : order.status === 'READY' && order.fulfillmentType === 'PICKUP'
                ? 'Заказ готов — ждём вас в кондитерской!'
                : STATUS_HINTS[order.status]}
          </Text>
          {isCancelled && order.cancelReason ? <Text style={[styles.heroText, { fontWeight: '700' }]}>Причина: {order.cancelReason}</Text> : null}
        </View>

        {order.canPay ? (
          <Card style={{ gap: space.md }}>
            <Notice
              tone={order.paymentStatus === 'FAILED' ? 'danger' : 'warning'}
              text={order.paymentStatus === 'FAILED' ? 'Оплата не прошла. Попробуйте ещё раз или выберите другой способ.' : `Заказ ждёт оплаты. Неоплаченный заказ отменится через ${store.data?.paymentTimeoutMinutes ?? 30} минут.`}
            />
            <Button title={`Оплатить ${formatRub(order.totalAmount)}`} icon="card-outline" onPress={pay} loading={paying} />
          </Card>
        ) : null}

        {!isCancelled ? (
          <Card>
            {steps.map((s, i) => {
              const done = i <= currentIndex;
              const current = i === currentIndex;
              const at = reachedAt(s);
              return (
                <View key={s} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={[styles.stepDot, done && styles.stepDotDone, current && styles.stepDotCurrent]}>
                      {done ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
                    </View>
                    {i < steps.length - 1 ? <View style={[styles.stepLine, i < currentIndex && { backgroundColor: colors.primary }]} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 18 : 0 }}>
                    <Text style={[styles.stepTitle, !done && { color: colors.muted }]}>{ORDER_STATUS_LABELS[s]}</Text>
                    {at ? <Text style={font.small}>{formatDateTimeMsk(at)}</Text> : null}
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}

        <Card style={{ gap: 10 }}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={font.small}>{order.fulfillmentType === 'DELIVERY' ? 'Доставка' : 'Самовывоз'}</Text>
              <Text style={styles.infoValue}>{formatDateRu(order.deliveryDate)}, {formatSlot(order.slotStartMinutes, order.slotEndMinutes)}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name={order.fulfillmentType === 'DELIVERY' ? 'location-outline' : 'storefront-outline'} size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={font.small}>{order.fulfillmentType === 'DELIVERY' ? order.deliveryZone?.name ?? 'Адрес' : 'Адрес кондитерской'}</Text>
              <Text style={styles.infoValue}>{order.fulfillmentType === 'DELIVERY' ? address : order.pickupAddress}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={font.small}>Получатель</Text>
              <Text style={styles.infoValue}>{order.customerName}{order.customerPhone ? `, ${formatPhone(order.customerPhone)}` : ''}</Text>
            </View>
          </View>
          {order.comment ? (
            <View style={styles.infoRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
              <Text style={[font.body, { flex: 1 }]}>{order.comment}</Text>
            </View>
          ) : null}
        </Card>

        <Card style={{ gap: space.md }}>
          <Text style={font.h3}>Состав</Text>
          {order.items.map((i) => (
            <View key={i.id} style={styles.item}>
              <Image source={absoluteUrl(i.imageUrl) ?? undefined} style={styles.itemImage} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{i.productName}</Text>
                <Text style={font.small}>{i.quantity} × {formatRub(i.unitPrice)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatRub(i.totalAmount)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <Row label="Товары" value={formatRub(order.subtotalAmount)} />
          {order.discountAmount ? <Row label={`Скидка${order.promoCode ? ` (${order.promoCode})` : ''}`} value={`−${formatRub(order.discountAmount)}`} /> : null}
          {order.fulfillmentType === 'DELIVERY' ? <Row label="Доставка" value={order.deliveryAmount ? formatRub(order.deliveryAmount) : 'бесплатно'} /> : null}
          <Row label="Итого" value={formatRub(order.totalAmount)} strong />
          <Text style={font.small}>{PAYMENT_METHOD_LABELS[order.paymentMethod]} · {PAYMENT_STATUS_LABELS[order.paymentStatus]}</Text>
        </Card>

        <View style={{ gap: space.sm }}>
          <Button title="Повторить заказ" icon="repeat" variant="secondary" onPress={repeat} loading={repeating} />
          {store.data?.phone ? (
            <Button title={`Позвонить: ${store.data.phone}`} icon="call-outline" variant="ghost" onPress={() => Linking.openURL(`tel:${store.data!.phone.replace(/[^\d+]/g, '')}`)} />
          ) : null}
        </View>
        <View style={{ alignItems: 'center' }}><StatusBadge status={order.status} /></View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xxl, maxWidth: 720, width: '100%', alignSelf: 'center' },
  hero: { backgroundColor: colors.primarySoft, borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: 8 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  heroText: { fontSize: 15, color: '#5b4a41', textAlign: 'center', lineHeight: 21 },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 22 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepDotCurrent: { transform: [{ scale: 1.15 }] },
  stepLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemImage: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemTotal: { fontSize: 15, fontWeight: '700', color: colors.text },
});
