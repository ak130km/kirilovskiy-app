import { formatRub, formatWeight } from '@kirilovskiy/shared';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProduct } from '@/api/hooks';
import { Badge, Button, ErrorView, Loader, Notice, QuantityStepper } from '@/components/ui';
import { absoluteUrl } from '@/lib/config';
import { useCart } from '@/store/cart';
import { colors, font, radius, space } from '@/theme';

const MAX_WIDTH = 720;

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, MAX_WIDTH);
  const insets = useSafeAreaInsets();
  const { data: p, isLoading, isError, error, refetch } = useProduct(id);
  const line = useCart((s) => s.lines.find((l) => l.productId === id));
  const add = useCart((s) => s.add);
  const setQuantity = useCart((s) => s.setQuantity);
  const [slide, setSlide] = useState(0);

  if (isLoading) return <Loader />;
  if (isError || !p) return <ErrorView message={error?.message ?? 'Товар не найден'} onRetry={() => refetch()} />;

  const images = p.images.length ? p.images : [{ id: 'none', url: '', sortOrder: 0 }];
  const addToCart = () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    add({ productId: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl, weightGrams: p.weightGrams });
  };
  const hasNutrition = p.caloriesKcal !== null || p.proteins !== null;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: p.category.name }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' }}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(i) => i.id}
          onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
          onScroll={Platform.OS === 'web' ? (e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width)) : undefined}
          scrollEventThrottle={64}
          renderItem={({ item }) => (
            <Image source={absoluteUrl(item.url) ?? undefined} style={{ width, height: width * 0.85, backgroundColor: colors.cardAlt }} contentFit="cover" transition={200} />
          )}
        />
        {images.length > 1 ? (
          <View style={styles.dots}>
            {images.map((img, i) => <View key={img.id} style={[styles.dot, i === slide && styles.dotOn]} />)}
          </View>
        ) : null}

        <View style={styles.body}>
          <Text style={font.title}>{p.name}</Text>
          <View style={styles.metaRow}>
            <Badge text={formatWeight(p.weightGrams)} />
            {p.leadTimeHours ? <Badge text={`Готовим ${p.leadTimeHours} ч`} tone="warning" /> : null}
            {!p.isAvailable ? <Badge text="Нет в наличии" tone="danger" /> : null}
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatRub(p.price)}</Text>
            {p.oldPrice ? <Text style={styles.oldPrice}>{formatRub(p.oldPrice)}</Text> : null}
          </View>

          {p.description ? <Text style={font.body}>{p.description}</Text> : null}

          {p.leadTimeHours ? (
            <Notice tone="info" icon="time-outline" text={`Этот десерт готовим под заказ: ближайшая дата доставки — не раньше чем через ${p.leadTimeHours} ч.`} />
          ) : null}

          {p.composition ? (
            <View style={styles.section}>
              <Text style={font.h3}>Состав</Text>
              <Text style={[font.body, { color: '#5b4a41' }]}>{p.composition}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={font.h3}>Аллергены</Text>
            {p.allergens.length ? (
              <View style={styles.chips}>
                {p.allergens.map((a) => (
                  <View key={a.id} style={styles.allergen}><Text style={styles.allergenText}>{a.name}</Text></View>
                ))}
              </View>
            ) : (
              <Text style={font.body}>Не содержит основных аллергенов</Text>
            )}
          </View>

          {hasNutrition ? (
            <View style={styles.section}>
              <Text style={font.h3}>Пищевая ценность на 100 г</Text>
              <View style={styles.nutrition}>
                {[
                  ['ккал', p.caloriesKcal],
                  ['белки', p.proteins],
                  ['жиры', p.fats],
                  ['углеводы', p.carbohydrates],
                ].map(([label, value]) => (
                  <View key={String(label)} style={styles.nutritionCell}>
                    <Text style={styles.nutritionValue}>{value === null ? '—' : String(value).replace('.', ',')}</Text>
                    <Text style={font.small}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {p.storageConditions ? (
            <View style={styles.section}>
              <Text style={font.h3}>Хранение</Text>
              <Text style={font.body}>{p.storageConditions}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {!p.isAvailable ? (
          <Button title="Временно нет в наличии" disabled style={{ flex: 1 }} />
        ) : line ? (
          <>
            <QuantityStepper value={line.quantity} onChange={(q) => setQuantity(p.id, q)} />
            <Button title={`В корзину · ${formatRub(line.quantity * p.price)}`} onPress={() => router.navigate('/cart')} style={{ flex: 1 }} icon="bag-check-outline" />
          </>
        ) : (
          <Button title={`Добавить · ${formatRub(p.price)}`} onPress={addToCart} style={{ flex: 1 }} icon="bag-add-outline" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -22, marginBottom: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotOn: { backgroundColor: colors.white, width: 18 },
  body: { padding: space.lg, gap: space.md },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  price: { fontSize: 26, fontWeight: '800', color: colors.text },
  oldPrice: { fontSize: 17, color: colors.muted, textDecorationLine: 'line-through' },
  section: { gap: 8, marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allergen: { backgroundColor: colors.warningSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  allergenText: { color: colors.warning, fontWeight: '700', fontSize: 13 },
  nutrition: { flexDirection: 'row', gap: 8 },
  nutritionCell: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  nutritionValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: space.md, alignItems: 'center',
    paddingHorizontal: space.lg, paddingTop: space.md,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
});
