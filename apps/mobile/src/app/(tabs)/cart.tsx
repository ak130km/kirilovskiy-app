import { formatRub, formatWeight } from '@kirilovskiy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCartQuote } from '@/api/hooks';
import { Button, Card, EmptyState, Notice, QuantityStepper, Row } from '@/components/ui';
import { absoluteUrl } from '@/lib/config';
import { useCart } from '@/store/cart';
import { colors, font, radius, space } from '@/theme';

export default function CartScreen() {
  const lines = useCart((s) => s.lines);
  const promoCode = useCart((s) => s.promoCode);
  const setPromoCode = useCart((s) => s.setPromoCode);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const replaceAll = useCart((s) => s.replaceAll);
  const [promoInput, setPromoInput] = useState(promoCode);

  const items = useMemo(() => lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), [lines]);
  const quote = useCartQuote({ items, promoCode: promoCode || undefined });
  const q = quote.data;

  // Подтягиваем актуальные цены и названия с сервера в локальную корзину
  useEffect(() => {
    if (!q) return;
    const changed = lines.some((l) => {
      const item = q.items.find((i) => i.productId === l.productId);
      return item && item.isAvailable && (item.unitPrice !== l.price || item.weightGrams !== l.weightGrams);
    });
    if (changed) {
      replaceAll(
        lines.map((l) => {
          const item = q.items.find((i) => i.productId === l.productId);
          return item && item.isAvailable ? { ...l, price: item.unitPrice, weightGrams: item.weightGrams, name: item.name } : l;
        }),
      );
    }
  }, [q, lines, replaceAll]);

  if (lines.length === 0) {
    return (
      <EmptyState
        icon="bag-handle-outline"
        title="Корзина пуста"
        text="Добавьте десерты из каталога — торты, эклеры, макарон"
        action={<Button title="Перейти в каталог" onPress={() => router.navigate('/')} size="md" />}
      />
    );
  }

  const unavailable = q?.items.filter((i) => !i.isAvailable) ?? [];
  const otherProblems = q?.problems.filter((p) => !p.startsWith('Некоторые товары')) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        {lines.map((line) => {
          const item = q?.items.find((i) => i.productId === line.productId);
          const isAvailable = item?.isAvailable ?? true;
          return (
            <View key={line.productId} style={[styles.line, !isAvailable && { opacity: 0.6 }]}>
              <Pressable onPress={() => router.push(`/product/${line.productId}`)}>
                <Image source={absoluteUrl(line.imageUrl) ?? undefined} style={styles.image} contentFit="cover" />
              </Pressable>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={font.h3} numberOfLines={2}>{line.name}</Text>
                <Text style={font.small}>
                  {line.weightGrams ? `${formatWeight(line.weightGrams)} · ` : ''}{formatRub(line.price)}
                </Text>
                {!isAvailable ? <Text style={styles.unavailable}>{item?.unavailableReason}</Text> : null}
                <View style={styles.lineFooter}>
                  {isAvailable ? (
                    <QuantityStepper compact value={line.quantity} onChange={(v) => setQuantity(line.productId, v)} />
                  ) : (
                    <Button title="Удалить" variant="danger" size="sm" onPress={() => remove(line.productId)} />
                  )}
                  <Text style={font.price}>{formatRub(line.price * line.quantity)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {unavailable.length ? (
          <Notice tone="danger" text="Некоторых товаров сейчас нет в наличии — удалите их, чтобы оформить заказ." />
        ) : null}

        <Card style={{ gap: space.md }}>
          <Text style={font.h3}>Промокод</Text>
          <View style={styles.promoRow}>
            <TextInput
              value={promoInput}
              onChangeText={(v) => setPromoInput(v.toUpperCase())}
              placeholder="Например, WELCOME10"
              placeholderTextColor="#b9a79d"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.promoInput}
            />
            {promoCode ? (
              <Button title="Убрать" variant="secondary" size="md" onPress={() => { setPromoCode(''); setPromoInput(''); }} />
            ) : (
              <Button title="Применить" variant="secondary" size="md" disabled={!promoInput.trim()} onPress={() => setPromoCode(promoInput.trim())} />
            )}
          </View>
          {q?.promoCode ? (
            <View style={styles.promoResult}>
              <Ionicons name={q.promoCode.applied ? 'checkmark-circle' : 'alert-circle'} size={18} color={q.promoCode.applied ? colors.success : colors.danger} />
              <Text style={{ color: q.promoCode.applied ? colors.success : colors.danger, flex: 1 }}>{q.promoCode.message}</Text>
            </View>
          ) : null}
        </Card>

        <Card style={{ gap: 4 }}>
          <Row label="Товары" value={formatRub(q?.subtotalAmount ?? 0)} />
          {q?.discountAmount ? <Row label="Скидка" value={`−${formatRub(q.discountAmount)}`} /> : null}
          <Row label="Доставка" value="на следующем шаге" />
          <View style={styles.divider} />
          <Row label="Итого" value={formatRub((q?.subtotalAmount ?? 0) - (q?.discountAmount ?? 0))} strong />
        </Card>

        {otherProblems.map((p) => <Notice key={p} text={p} />)}
      </ScrollView>
      <View style={styles.bottomBar}>
        <Button
          title="Оформить заказ"
          icon="arrow-forward"
          loading={quote.isFetching && !q}
          disabled={!q?.canCheckout}
          onPress={() => router.push('/checkout')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: 110, maxWidth: 720, width: '100%', alignSelf: 'center' },
  line: { flexDirection: 'row', gap: space.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md },
  image: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.cardAlt },
  lineFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  unavailable: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  promoRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  promoInput: {
    flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, fontSize: 16, color: colors.text, backgroundColor: colors.bg,
  },
  promoResult: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingTop: space.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
