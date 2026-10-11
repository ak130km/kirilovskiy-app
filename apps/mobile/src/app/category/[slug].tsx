import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useCategories, useProducts } from '@/api/hooks';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState, ErrorView, Loader } from '@/components/ui';
import { colors, font, space } from '@/theme';

const MAX_WIDTH = 720;

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, MAX_WIDTH);
  const cardWidth = (width - space.lg * 2 - space.md) / 2;
  const categories = useCategories();
  const products = useProducts({ category: slug });
  const category = categories.data?.find((c) => c.slug === slug);

  return (
    <>
      <Stack.Screen options={{ title: category?.name ?? '' }} />
      {products.isLoading ? <Loader /> : null}
      {products.isError ? <ErrorView message={products.error.message} onRetry={() => products.refetch()} /> : null}
      {products.data ? (
        <FlatList
          data={products.data}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={[styles.list, { maxWidth: MAX_WIDTH }]}
          ListHeaderComponent={category?.description ? <Text style={[font.body, { color: colors.muted, marginBottom: space.md }]}>{category.description}</Text> : null}
          ListEmptyComponent={<EmptyState icon="ice-cream-outline" title="Здесь пока пусто" text="Скоро добавим новые десерты" />}
          renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
          refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => products.refetch()} tintColor={colors.primary} />}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md, width: '100%', alignSelf: 'center' },
});
