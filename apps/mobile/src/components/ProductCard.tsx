import type { ProductListItemDto } from '@kirilovskiy/shared';
import { formatRub, formatWeight } from '@kirilovskiy/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { absoluteUrl } from '@/lib/config';
import { useCart } from '@/store/cart';
import { colors, radius, shadow } from '@/theme';
import { QuantityStepper } from './ui';

export function ProductCard({ product, width }: { product: ProductListItemDto; width: number }) {
  const line = useCart((s) => s.lines.find((l) => l.productId === product.id));
  const add = useCart((s) => s.add);
  const setQuantity = useCart((s) => s.setQuantity);

  const addToCart = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    add({ productId: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl, weightGrams: product.weightGrams });
  };

  return (
    <View style={[styles.card, { width }]}>
      <Link href={`/product/${product.id}`} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={product.name}>
          <Image
            source={absoluteUrl(product.imageUrl) ?? undefined}
            style={[styles.image, { width, height: width }, !product.isAvailable && { opacity: 0.45 }]}
            contentFit="cover"
            transition={200}
          />
          {!product.isAvailable ? (
            <View style={styles.soldOut}>
              <Text style={styles.soldOutText}>Нет в наличии</Text>
            </View>
          ) : product.oldPrice ? (
            <View style={[styles.soldOut, { backgroundColor: colors.primary }]}>
              <Text style={[styles.soldOutText, { color: colors.white }]}>Скидка</Text>
            </View>
          ) : null}
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
            <Text style={styles.weight}>
              {formatWeight(product.weightGrams)}
              {product.leadTimeHours ? ` · за ${product.leadTimeHours} ч` : ''}
            </Text>
          </View>
        </Pressable>
      </Link>
      <View style={styles.footer}>
        <View>
          <Text style={styles.price}>{formatRub(product.price)}</Text>
          {product.oldPrice ? <Text style={styles.oldPrice}>{formatRub(product.oldPrice)}</Text> : null}
        </View>
        {!product.isAvailable ? null : line ? (
          <QuantityStepper compact value={line.quantity} onChange={(q) => setQuantity(product.id, q)} />
        ) : (
          <Pressable accessibilityLabel={`Добавить ${product.name} в корзину`} onPress={addToCart} style={styles.add} hitSlop={8}>
            <Ionicons name="add" size={22} color={colors.white} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  image: { backgroundColor: colors.cardAlt },
  info: { paddingHorizontal: 12, paddingTop: 10, gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, minHeight: 40 },
  weight: { fontSize: 13, color: colors.muted },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingTop: 8, minHeight: 56 },
  price: { fontSize: 16, fontWeight: '800', color: colors.text },
  oldPrice: { fontSize: 12, color: colors.muted, textDecorationLine: 'line-through' },
  add: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  soldOut: { position: 'absolute', top: 10, left: 10, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  soldOutText: { fontSize: 12, fontWeight: '700', color: colors.text },
});
