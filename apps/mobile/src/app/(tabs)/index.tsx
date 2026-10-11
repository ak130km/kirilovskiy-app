import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCategories, useProducts, useStoreInfo } from '@/api/hooks';
import { ProductCard } from '@/components/ProductCard';
import { ErrorView, Loader, Notice, SectionTitle } from '@/components/ui';
import { absoluteUrl } from '@/lib/config';
import { colors, font, radius, shadow, space } from '@/theme';

const MAX_WIDTH = 720;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, MAX_WIDTH);
  const cardWidth = (width - space.lg * 2 - space.md) / 2;
  const store = useStoreInfo();
  const categories = useCategories();
  const featured = useProducts({ featured: true });

  const refreshing = categories.isRefetching || featured.isRefetching;
  const refresh = () => {
    void categories.refetch();
    void featured.refetch();
    void store.refetch();
  };

  if (categories.isError && featured.isError) {
    return <ErrorView message={categories.error.message} onRetry={refresh} />;
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + space.lg, maxWidth: MAX_WIDTH }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Text style={styles.kicker}>Кондитерская</Text>
      <Text style={font.title}>Артёма Кирилловского</Text>
      <Text style={[font.small, { marginTop: 4 }]}>Доставка по Москве и самовывоз</Text>

      {store.data && !store.data.acceptingOrders ? (
        <View style={{ marginTop: space.lg }}>
          <Notice text={store.data.acceptingOrdersMessage} tone="warning" />
        </View>
      ) : null}

      <Pressable style={styles.banner} onPress={() => router.push('/category/torty')}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.bannerTitle}>Торты на заказ</Text>
          <Text style={styles.bannerText}>Медовик, Наполеон, Красный бархат — приготовим к нужной дате</Text>
          <Text style={styles.bannerLink}>Выбрать торт →</Text>
        </View>
        <Image source={absoluteUrl('/static/seed/red-velvet.svg') ?? undefined} style={styles.bannerImage} contentFit="cover" />
      </Pressable>

      <SectionTitle title="Каталог" />
      {categories.isLoading ? <Loader /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg, paddingLeft: space.lg, marginBottom: space.xl }}>
        {categories.data?.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}`} asChild>
            <Pressable style={styles.category}>
              <Image source={absoluteUrl(c.imageUrl) ?? undefined} style={styles.categoryImage} contentFit="cover" />
              <Text style={styles.categoryName}>{c.name}</Text>
              <Text style={font.small}>{c.productCount} шт.</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>

      <SectionTitle title="Популярное" />
      {featured.isLoading ? <Loader /> : null}
      <View style={styles.grid}>
        {featured.data?.map((p) => <ProductCard key={p.id} product={p} width={cardWidth} />)}
      </View>

      {store.data ? (
        <View style={styles.footer}>
          <Text style={font.h3}>Самовывоз</Text>
          <Text style={font.body}>{store.data.pickupAddress}</Text>
          <Text style={font.small}>{store.data.pickupHours} · {store.data.phone}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: space.xxl, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 14, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  banner: {
    marginTop: space.xl,
    marginBottom: space.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    overflow: 'hidden',
    ...shadow,
  },
  bannerTitle: { fontSize: 22, fontWeight: '800', color: colors.white },
  bannerText: { fontSize: 14, color: '#fbe9e1', lineHeight: 19 },
  bannerLink: { fontSize: 15, fontWeight: '700', color: colors.white, marginTop: 4 },
  bannerImage: { width: 110, height: 110, borderRadius: radius.lg },
  category: { width: 112, backgroundColor: colors.card, borderRadius: radius.lg, padding: 8, gap: 4, ...shadow },
  categoryImage: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.cardAlt },
  categoryName: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  footer: { marginTop: space.xl, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.cardAlt, gap: 4 },
});
