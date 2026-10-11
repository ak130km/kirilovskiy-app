import { Injectable, NotFoundException } from '@nestjs/common';
import type { CategoryDto, ProductDetailsDto, ProductListItemDto } from '@kirilovskiy/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { productInclude, toProductDetails, toProductListItem } from './catalog.mapper';

const publishedProduct: Prisma.ProductWhereInput = {
  isActive: true,
  archivedAt: null,
  category: { isActive: true },
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async categories(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: publishedProduct } } } },
    });
    return rows
      .filter((c) => c._count.products > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        sortOrder: c.sortOrder,
        productCount: c._count.products,
      }));
  }

  async products(q: { category?: string; featured?: boolean; search?: string }): Promise<ProductListItemDto[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        ...publishedProduct,
        category: { isActive: true, ...(q.category ? { slug: q.category } : {}) },
        isFeatured: q.featured ? true : undefined,
        name: q.search ? { contains: q.search, mode: 'insensitive' } : undefined,
      },
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const items = rows.map(toProductListItem);
    // Доступные товары — выше, товары из стоп-листа — в конце списка
    return items.sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable));
  }

  async product(idOrSlug: string): Promise<ProductDetailsDto> {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const row = await this.prisma.product.findFirst({
      where: { ...publishedProduct, ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }) },
      include: productInclude,
    });
    if (!row) throw new NotFoundException('Товар не найден');
    return toProductDetails(row);
  }
}
