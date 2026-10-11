import type { CreateOrderResponse, FulfillmentType, PaymentMethod } from '@kirilovskiy/shared';
import { formatRub, maskPhoneInput, normalizePhone } from '@kirilovskiy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorText } from '@/api/client';
import { queryKeys, useAvailability, useCartQuote, useStoreInfo, useZones } from '@/api/hooks';
import { Button, Card, Chip, EmptyState, Field, Loader, Notice, Row } from '@/components/ui';
import { registerForPush } from '@/lib/notifications';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { colors, font, radius, space } from '@/theme';

type Errors = Partial<Record<'zone' | 'address' | 'slot' | 'name' | 'phone' | 'form', string>>;

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const lines = useCart((s) => s.lines);
  const promoCode = useCart((s) => s.promoCode);
  const clearCart = useCart((s) => s.clear);
  const saved = useSession((s) => s.checkout);
  const customer = useSession((s) => s.customer);
  const addGuestOrder = useSession((s) => s.addGuestOrder);
  const saveCheckout = useSession((s) => s.saveCheckout);

  const [type, setType] = useState<FulfillmentType>(saved.fulfillmentType ?? 'DELIVERY');
  const [zoneId, setZoneId] = useState<string | undefined>(saved.deliveryZoneId);
  const [address, setAddress] = useState(saved.address ?? '');
  const [apartment, setApartment] = useState(saved.apartment ?? '');
  const [entrance, setEntrance] = useState(saved.entrance ?? '');
  const [floor, setFloor] = useState(saved.floor ?? '');
  const [intercom, setIntercom] = useState(saved.intercom ?? '');
  const [date, setDate] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [name, setName] = useState(saved.customerName ?? customer?.name ?? '');
  const [phone, setPhone] = useState(maskPhoneInput(saved.customerPhone ?? customer?.phone ?? ''));
  const [comment, setComment] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>(saved.paymentMethod ?? 'CARD');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const items = useMemo(() => lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), [lines]);
  const store = useStoreInfo();
  const zones = useZones();
  const availability = useAvailability(type, items.map((i) => i.productId));
  const quote = useCartQuote({
    items,
    fulfillmentType: type,
    deliveryZoneId: type === 'DELIVERY' ? zoneId : undefined,
    promoCode: promoCode || undefined,
  });

  // Зона по умолчанию — первая в списке
  useEffect(() => {
    if (type === 'DELIVERY' && zones.data?.length && !zones.data.some((z) => z.id === zoneId)) setZoneId(zones.data[0].id);
  }, [type, zones.data, zoneId]);

  // Если выбранная дата пропала (другой способ получения, кончились места) — выбираем первую доступную
  useEffect(() => {
    const days = availability.data;
    if (!days) return;
    const day = days.find((d) => d.date === date) ?? days.find((d) => d.slots.some((s) => s.available));
    if (day?.date !== date) setDate(day?.date ?? null);
    if (!day?.slots.some((s) => s.id === slotId && s.available)) setSlotId(null);
  }, [availability.data, date, slotId]);

  if (lines.length === 0) {
    return <EmptyState icon="bag-handle-outline" title="Корзина пуста" action={<Button title="В каталог" size="md" onPress={() => router.replace('/')} />} />;
  }

  const day = availability.data?.find((d) => d.date === date);
  const q = quote.data;

  async function submit() {
    const e: Errors = {};
    if (type === 'DELIVERY' && !zoneId) e.zone = 'Выберите зону доставки';
    if (type === 'DELIVERY' && address.trim().length < 5) e.address = 'Укажите улицу и дом';
    if (!date || !slotId) e.slot = 'Выберите дату и время';
    if (name.trim().length < 2) e.name = 'Как к вам обращаться?';
    const normalized = normalizePhone(phone);
    if (!normalized) e.phone = 'Номер в формате +7 9XX XXX-XX-XX';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSubmitting(true);
    try {
      // Разрешение на уведомления спрашиваем в момент, когда клиенту понятно зачем — для статуса заказа
      const deviceId = await registerForPush(true);
      const res = await api.post<CreateOrderResponse>('/orders', {
        items,
        fulfillmentType: type,
        deliveryZoneId: type === 'DELIVERY' ? zoneId : undefined,
        address: type === 'DELIVERY' ? address : undefined,
        apartment: type === 'DELIVERY' ? apartment : undefined,
        entrance: type === 'DELIVERY' ? entrance : undefined,
        floor: type === 'DELIVERY' ? floor : undefined,
        intercom: type === 'DELIVERY' ? intercom : undefined,
        deliveryDate: date,
        timeSlotId: slotId,
        customerName: name.trim(),
        customerPhone: normalized,
        comment: comment.trim() || undefined,
        paymentMethod: payment,
        promoCode: promoCode || undefined,
        deviceId: deviceId ?? undefined,
      });
      addGuestOrder({ id: res.order.id, accessToken: res.accessToken, number: res.order.number, createdAt: res.order.createdAt });
      saveCheckout({
        customerName: name.trim(), customerPhone: normalized!, fulfillmentType: type, deliveryZoneId: zoneId,
        address, apartment, entrance, floor, intercom, paymentMethod: payment,
      });
      clearCart();
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      router.replace({ pathname: '/order/[id]', params: { id: res.order.id, autopay: '1' } });
    } catch (err) {
      setErrors({ form: errorText(err) });
      void availability.refetch();
      void quote.refetch();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* 1. Способ получения */}
        <View style={styles.segment}>
          {(['DELIVERY', 'PICKUP'] as const).map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.segmentItem, type === t && styles.segmentOn]}>
              <Ionicons name={t === 'DELIVERY' ? 'bicycle-outline' : 'storefront-outline'} size={18} color={type === t ? colors.text : colors.muted} />
              <Text style={[styles.segmentText, type === t && { color: colors.text }]}>{t === 'DELIVERY' ? 'Доставка' : 'Самовывоз'}</Text>
            </Pressable>
          ))}
        </View>

        {type === 'DELIVERY' ? (
          <Card style={{ gap: space.md }}>
            <Text style={font.h3}>Зона доставки</Text>
            {zones.isLoading ? <Loader /> : null}
            {zones.data?.map((z) => {
              const on = z.id === zoneId;
              return (
                <Pressable key={z.id} onPress={() => setZoneId(z.id)} style={[styles.option, on && styles.optionOn]}>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.primary : colors.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{z.name}</Text>
                    <Text style={font.small}>
                      {formatRub(z.price)}
                      {z.freeFromAmount ? ` · бесплатно от ${formatRub(z.freeFromAmount)}` : ''}
                      {z.minOrderAmount ? ` · заказ от ${formatRub(z.minOrderAmount)}` : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {errors.zone ? <Text style={styles.error}>{errors.zone}</Text> : null}
            <Field label="Улица и дом *" value={address} onChangeText={setAddress} placeholder="ул. Тверская, д. 7" error={errors.address} autoComplete="street-address" />
            <View style={styles.fieldsRow}>
              <Field style={{ flex: 1 }} label="Квартира" value={apartment} onChangeText={setApartment} keyboardType="numbers-and-punctuation" />
              <Field style={{ flex: 1 }} label="Подъезд" value={entrance} onChangeText={setEntrance} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={styles.fieldsRow}>
              <Field style={{ flex: 1 }} label="Этаж" value={floor} onChangeText={setFloor} keyboardType="numbers-and-punctuation" />
              <Field style={{ flex: 1 }} label="Домофон" value={intercom} onChangeText={setIntercom} />
            </View>
          </Card>
        ) : (
          <Card style={{ gap: 6 }}>
            <Text style={font.h3}>Заберите заказ в кондитерской</Text>
            <Text style={font.body}>{store.data?.pickupAddress}</Text>
            <Text style={font.small}>{store.data?.pickupHours}</Text>
          </Card>
        )}

        {/* 2. Дата и интервал */}
        <Card style={{ gap: space.md }}>
          <Text style={font.h3}>{type === 'DELIVERY' ? 'Когда доставить' : 'Когда заберёте'}</Text>
          {availability.isLoading ? <Loader /> : null}
          {availability.data?.length === 0 ? <Notice text="Свободных интервалов на ближайшие дни нет. Позвоните нам — постараемся помочь." /> : null}
          {q?.leadTimeHours ? <Text style={font.small}>В заказе есть десерты, которые готовим {q.leadTimeHours} ч — показаны подходящие даты.</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {availability.data?.map((d) => (
              <Chip
                key={d.date}
                label={d.isToday ? 'Сегодня' : d.label.split(', ')[0]}
                sublabel={d.label.split(', ')[1]}
                selected={d.date === date}
                disabled={!d.slots.some((s) => s.available)}
                onPress={() => { setDate(d.date); setSlotId(null); }}
              />
            ))}
          </ScrollView>
          {day ? (
            <View style={styles.slots}>
              {day.slots.map((s) => (
                <Chip key={s.id} label={s.label} sublabel={s.available ? undefined : 'мест нет'} selected={s.id === slotId} disabled={!s.available} onPress={() => setSlotId(s.id)} />
              ))}
            </View>
          ) : null}
          {errors.slot ? <Text style={styles.error}>{errors.slot}</Text> : null}
        </Card>

        {/* 3. Контакты */}
        <Card style={{ gap: space.md }}>
          <Text style={font.h3}>Контакты</Text>
          <Field label="Имя *" value={name} onChangeText={setName} placeholder="Анна" error={errors.name} autoComplete="name" />
          <Field label="Телефон *" value={phone} onChangeText={(v) => setPhone(maskPhoneInput(v))} keyboardType="phone-pad" placeholder="+7 900 000-00-00" error={errors.phone} autoComplete="tel" />
          <Field label="Комментарий" value={comment} onChangeText={setComment} placeholder="Надпись на торте, пожелания курьеру" multiline maxLength={1000} />
        </Card>

        {/* 4. Оплата */}
        <Card style={{ gap: space.md }}>
          <Text style={font.h3}>Оплата</Text>
          {([
            ['CARD', 'Банковская карта', 'card-outline'],
            ['SBP', 'СБП — Система быстрых платежей', 'qr-code-outline'],
          ] as const).map(([m, label, icon]) => {
            const on = payment === m;
            return (
              <Pressable key={m} onPress={() => setPayment(m)} style={[styles.option, on && styles.optionOn]}>
                <Ionicons name={icon} size={22} color={on ? colors.primary : colors.muted} />
                <Text style={[styles.optionTitle, { flex: 1 }]}>{label}</Text>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? colors.primary : colors.border} />
              </Pressable>
            );
          })}
        </Card>

        {/* 5. Итог */}
        <Card style={{ gap: 4 }}>
          <Row label="Товары" value={formatRub(q?.subtotalAmount ?? 0)} />
          {q?.discountAmount ? <Row label={`Скидка${q.promoCode?.applied ? ` (${q.promoCode.code})` : ''}`} value={`−${formatRub(q.discountAmount)}`} /> : null}
          {type === 'DELIVERY' ? <Row label="Доставка" value={q ? (q.deliveryAmount ? formatRub(q.deliveryAmount) : 'бесплатно') : '—'} /> : null}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
          <Row label="К оплате" value={formatRub(q?.totalAmount ?? 0)} strong />
        </Card>

        {q?.problems.map((p) => <Notice key={p} text={p} tone="danger" />)}
        {errors.form ? <Notice text={errors.form} tone="danger" /> : null}

        <Text style={styles.legal}>
          Нажимая «Оплатить», вы соглашаетесь на обработку персональных данных для выполнения заказа
          {store.data?.privacyPolicyUrl ? (
            <Text style={{ color: colors.primary }} onPress={() => Linking.openURL(store.data!.privacyPolicyUrl)}> (политика конфиденциальности)</Text>
          ) : null}
          . Регистрация не нужна.
        </Text>
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <Button
          title={`Оплатить ${q ? formatRub(q.totalAmount) : ''}`}
          icon={payment === 'SBP' ? 'qr-code-outline' : 'card-outline'}
          onPress={submit}
          loading={submitting}
          disabled={!q?.canCheckout || !availability.data?.length}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: 120, maxWidth: 720, width: '100%', alignSelf: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.card },
  segmentText: { fontSize: 15, fontWeight: '700', color: colors.muted },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  fieldsRow: { flexDirection: 'row', gap: space.md },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: colors.danger, fontSize: 13 },
  legal: { fontSize: 12, color: colors.muted, lineHeight: 17, textAlign: 'center', paddingHorizontal: space.md },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
