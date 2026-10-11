import type {
  AdminCategoryDto,
  AdminProductDto,
  ProductDetailsDto,
  ProductListItemDto,
} from '@kirilovskiy/shared';
import type { Allergen, Category, Prisma, Product, ProductImage } from '@prisma/client';

export const productInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
  allergens: { orderBy: { name: 'asc' } },
  category: true,
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Product & {
  images: ProductImage[];
  allergens: Allergen[];
  category: Category;
};

/** Товар доступен к заказу: опубликован, не в архиве и не в стоп-листе */
export function isProductAvailable(p: Product, now = new Date()): boolean {
  if (!p.isActive || p.archivedAt) return false;
  if (!p.inStopList) return true;
  return !!p.stopListUntil && p.stopListUntil <= now;
}

export function toProductListItem(p: Product & { images: ProductImage[] }): ProductListItemDto {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    categoryId: p.categoryId,
    price: p.price,
    oldPrice: p.oldPrice,
    weightGrams: p.weightGrams,
    imageUrl: p.images[0]?.url ?? null,
    isAvailable: isProductAvailable(p),
    isFeatured: p.isFeatured,
    leadTimeHours: p.leadTimeHours,
  };
}

export function toProductDetails(p: ProductWithRelations): ProductDetailsDto {
  return {
    ...toProductListItem(p),
    description: p.description,
    composition: p.composition,
    storageConditions: p.storageConditions,
    caloriesKcal: p.caloriesKcal,
    proteins: p.proteins,
    fats: p.fats,
    carbohydrates: p.carbohydrates,
    images: p.images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })),
    allergens: p.allergens.map((a) => ({ id: a.id, code: a.code, name: a.name })),
    category: { id: p.category.id, name: p.category.name, slug: p.category.slug },
  };
}

export function toAdminProduct(p: ProductWithRelations): AdminProductDto {
  return {
    ...toProductDetails(p),
    isActive: p.isActive,
    inStopList: p.inStopList,
    stopListReason: p.stopListReason,
    stopListUntil: p.stopListUntil?.toISOString() ?? null,
    sortOrder: p.sortOrder,
    externalId: p.externalId,
    archivedAt: p.archivedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toAdminCategory(c: Category & { _count: { products: number } }): AdminCategoryDto {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    sortOrder: c.sortOrder,
    productCount: c._count.products,
    isActive: c.isActive,
  };
}
