import type { OrderDto } from '@kirilovskiy/shared';
import { formatDateRu, formatDateTimeMsk, formatRub, formatSlot } from '@kirilovskiy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { errorText } from '@/api/client';
import { useOrderHistory } from '@/api/hooks';
import { Button, EmptyState, ErrorView, Loader, StatusBadge } from '@/components/ui';
import { repeatOrder } from '@/lib/reorder';
import { useSession } from '@/store/session';
import { colors, font, radius, shadow, space } from '@/theme';

function OrderRow({ order }: { order: OrderDto }) {
  const [busy, setBusy] = useState(false);
  const summary = order.items.map((i) => `${i.productName} × ${i.quantity}`).join(', ');

  async function repeat() {
    setBusy(true);
    try {
      const res = await repeatOrder(order.id);
      if (res.unavailable.length) {
        const text = `Сейчас недоступны: ${res.unavailable.join(', ')}`;
        if (Platform.OS === 'web') window.alert(text);
        else Alert.alert('Не всё есть в наличии', text);
      }
      router.navigate('/cart');
    } catch (e) {
      if (Platform.OS === 'web') window.alert(errorText(e));
      else Alert.alert('Не получилось', errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/order/${order.id}`)}>
      <View style={styles.header}>
        <Text style={font.h3}>№ {order.number}</Text>
        <StatusBadge status={order.status} />
        <Text style={[font.price, { marginLeft: 'auto' }]}>{formatRub(order.totalAmount)}</Text>
      </View>
      <Text style={font.body} numberOfLines={2}>{summary}</Text>
      <Text style={font.small}>
        {order.fulfillmentType === 'DELIVERY' ? 'Доставка' : 'Самовывоз'}: {formatDateRu(order.deliveryDate)}, {formatSlot(order.slotStartMinutes, order.slotEndMinutes)}
      </Text>
      <View style={styles.footer}>
        <Text style={font.small}>от {formatDateTimeMsk(order.createdAt)}</Text>
        <Button title="Повторить" icon="repeat" size="sm" variant="secondary" onPress={repeat} loading={busy} />
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useOrderHistory();
  const token = useSession((s) => s.token);

  if (isLoading) return <Loader />;
  if (isError) return <ErrorView message={error.message} onRetry={() => refetch()} />;

  return (
    <FlatList
      data={data}
      keyExtractor={(o) => o.id}
      contentContainerStyle={[styles.list, !data?.length && { flex: 1 }]}
      renderItem={({ item }) => <OrderRow order={item} />}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title="Заказов пока нет"
          text={token ? 'Здесь появятся ваши заказы' : 'Здесь появятся заказы с этого устройства. Войдите, чтобы видеть заказы со всех устройств.'}
          action={<Button title="Выбрать десерты" size="md" onPress={() => router.navigate('/')} />}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md, maxWidth: 720, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, gap: 8, ...shadow },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
});
