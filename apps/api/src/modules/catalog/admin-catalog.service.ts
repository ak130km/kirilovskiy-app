import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminCategoryDto, AdminProductDto } from '@kirilovskiy/shared';
import { formatDateTimeMsk, formatRub } from '@kirilovskiy/shared';
import type { AuthStaff } from '../../common/auth/auth.types';
import { slugify } from '../../common/utils/slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../uploads/storage.service';
import {
  AdminProductsQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  StopListDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './admin-catalog.dto';
import { productInclude, toAdminCategory, toAdminProduct } from './catalog.mapper';

const PRODUCT_AUDIT_FIELDS = [
  'name', 'categoryId', 'price', 'oldPrice', 'weightGrams', 'composition', 'description',
  'leadTimeHours', 'isActive', 'isFeatured', 'sortOrder', 'caloriesKcal', 'proteins', 'fats',
  'carbohydrates', 'storageConditions', 'externalId', 'slug',
] as const;

type Actor = { staff: AuthStaff; ip?: string | null };

@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  // ─────────── Категории ───────────

  async listCategories(): Promise<AdminCategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: { archivedAt: null } } } } },
    });
    return rows.map(toAdminCategory);
  }

  async createCategory(dto: CreateCategoryDto, actor: Actor): Promise<AdminCategoryDto> {
    const row = await this.prisma.category.create({
      data: { ...dto, slug: dto.slug || slugify(dto.name) },
      include: { _count: { select: { products: true } } },
    });
    await this.audit.log({
      ...actor,
      action: 'category.create',
      entityType: 'category',
      entityId: row.id,
      summary: `Создана категория «${row.name}»`,
    });
    return toAdminCategory(row);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, actor: Actor): Promise<AdminCategoryDto> {
    const before = await this.prisma.category.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Категория не найдена');
    const row = await this.prisma.category.update({
      where: { id },
      data: dto,
      include: { _count: { select: { products: { where: { archivedAt: null } } } } },
    });
    await this.audit.log({
      ...actor,
      action: 'category.update',
      entityType: 'category',
      entityId: id,
      summary: `Изменена категория «${row.name}»`,
      changes: AuditService.diff(before, row, ['name', 'slug', 'description', 'sortOrder', 'isActive', 'imageUrl']),
    });
    return toAdminCategory(row);
  }

  async deleteCategory(id: string, actor: Actor): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Категория не найдена');
    if (category._count.products > 0) {
      throw new ConflictException('В категории есть товары. Перенесите их или скройте категорию.');
    }
    await this.prisma.category.delete({ where: { id } });
    await this.audit.log({
      ...actor,
      action: 'category.delete',
      entityType: 'category',
      entityId: id,
      summary: `Удалена категория «${category.name}»`,
    });
  }

  // ─────────── Товары ───────────

  async listProducts(q: AdminProductsQueryDto): Promise<AdminProductDto[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        archivedAt: q.includeArchived ? undefined : null,
        categoryId: q.categoryId,
        inStopList: q.stopList ? true : undefined,
        OR: q.search
          ? [
              { name: { contains: q.search, mode: 'insensitive' } },
              { slug: { contains: q.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: productInclude,
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
      take: Math.min(q.limit ?? 500, 1000),
    });
    return rows.map(toAdminProduct);
  }

  async getProduct(id: string): Promise<AdminProductDto> {
    const row = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!row) throw new NotFoundException('Товар не найден');
    return toAdminProduct(row);
  }

  async createProduct(dto: CreateProductDto, actor: Actor): Promise<AdminProductDto> {
    const { allergenIds, ...data } = dto;
    const row = await this.prisma.product.create({
      data: {
        ...data,
        slug: dto.slug || (await this.uniqueSlug(slugify(dto.name))),
        allergens: allergenIds ? { connect: allergenIds.map((id) => ({ id })) } : undefined,
      },
      include: productInclude,
    });
    await this.audit.log({
      ...actor,
      action: 'product.create',
      entityType: 'product',
      entityId: row.id,
      summary: `Создан товар «${row.name}» — ${formatRub(row.price)}`,
    });
    return toAdminProduct(row);
  }

  async updateProduct(id: string, dto: UpdateProductDto, actor: Actor): Promise<AdminProductDto> {
    const before = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!before) throw new NotFoundException('Товар не найден');
    const { allergenIds, ...data } = dto;
    const row = await this.prisma.product.update({
      where: { id },
      data: {
        ...data,
        allergens: allergenIds ? { set: allergenIds.map((a) => ({ id: a })) } : undefined,
      },
      include: productInclude,
    });
    const changes: Record<string, unknown> = AuditService.diff(before, row, [...PRODUCT_AUDIT_FIELDS]) ?? {};
    if (allergenIds) {
      const was = before.allergens.map((a) => a.name).sort();
      const now = row.allergens.map((a) => a.name).sort();
      if (was.join() !== now.join()) changes.allergens = { from: was, to: now };
    }
    const priceChanged = before.price !== row.price;
    await this.audit.log({
      ...actor,
      action: priceChanged ? 'product.price' : 'product.update',
      entityType: 'product',
      entityId: id,
      summary: priceChanged
        ? `Цена «${row.name}»: ${formatRub(before.price)} → ${formatRub(row.price)}`
        : `Изменён товар «${row.name}»`,
      changes: Object.keys(changes).length ? changes : undefined,
    });
    return toAdminProduct(row);
  }

  /** Товар уходит в архив: исчезает из приложения, но остаётся в истории заказов */
  async archiveProduct(id: string, actor: Actor): Promise<void> {
    const row = await this.prisma.product.update({
      where: { id },
      data: { archivedAt: new Date(), isActive: false, isFeatured: false },
    });
    await this.audit.log({
      ...actor,
      action: 'product.archive',
      entityType: 'product',
      entityId: id,
      summary: `Товар «${row.name}» перенесён в архив`,
    });
  }

  async restoreProduct(id: string, actor: Actor): Promise<AdminProductDto> {
    const row = await this.prisma.product.update({
      where: { id },
      data: { archivedAt: null },
      include: productInclude,
    });
    await this.audit.log({
      ...actor,
      action: 'product.restore',
      entityType: 'product',
      entityId: id,
      summary: `Товар «${row.name}» восстановлен из архива`,
    });
    return toAdminProduct(row);
  }

  async setStopList(id: string, dto: StopListDto, actor: Actor): Promise<AdminProductDto> {
    const until = dto.inStopList && dto.until ? new Date(dto.until) : null;
    if (until && until <= new Date()) throw new BadRequestException('Дата возврата в продажу уже прошла');
    const row = await this.prisma.product.update({
      where: { id },
      data: {
        inStopList: dto.inStopList,
        stopListReason: dto.inStopList ? dto.reason ?? null : null,
        stopListUntil: until,
      },
      include: productInclude,
    });
    const untilText = until ? ` до ${formatDateTimeMsk(until)}` : '';
    await this.audit.log({
      ...actor,
      action: dto.inStopList ? 'stoplist.add' : 'stoplist.remove',
      entityType: 'product',
      entityId: id,
      summary: dto.inStopList
        ? `«${row.name}» добавлен в стоп-лист${untilText}${dto.reason ? `: ${dto.reason}` : ''}`
        : `«${row.name}» снова в продаже`,
    });
    return toAdminProduct(row);
  }

  // ─────────── Фото ───────────

  async addImage(id: string, file: Express.Multer.File, actor: Actor): Promise<AdminProductDto> {
    if (!file) throw new BadRequestException('Файл не передан');
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { images: true } } },
    });
    if (!product) throw new NotFoundException('Товар не найден');
    if (product._count.images >= 10) throw new BadRequestException('Не больше 10 фотографий у товара');
    const url = await this.storage.save(file);
    const last = await this.prisma.productImage.aggregate({ where: { productId: id }, _max: { sortOrder: true } });
    await this.prisma.productImage.create({
      data: { productId: id, url, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    await this.audit.log({
      ...actor,
      action: 'product.image_add',
      entityType: 'product',
      entityId: id,
      summary: `Добавлено фото товара «${product.name}»`,
    });
    return this.getProduct(id);
  }

  async removeImage(id: string, imageId: string, actor: Actor): Promise<AdminProductDto> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
      include: { product: true },
    });
    if (!image) throw new NotFoundException('Фото не найдено');
    await this.prisma.productImage.delete({ where: { id: imageId } });
    await this.storage.remove(image.url);
    await this.audit.log({
      ...actor,
      action: 'product.image_remove',
      entityType: 'product',
      entityId: id,
      summary: `Удалено фото товара «${image.product.name}»`,
    });
    return this.getProduct(id);
  }

  async reorderImages(id: string, imageIds: string[]): Promise<AdminProductDto> {
    await this.prisma.$transaction(
      imageIds.map((imageId, index) =>
        this.prisma.productImage.updateMany({ where: { id: imageId, productId: id }, data: { sortOrder: index } }),
      ),
    );
    return this.getProduct(id);
  }

  listAllergens() {
    return this.prisma.allergen.findMany({ orderBy: { name: 'asc' } });
  }

  private async uniqueSlug(base: string): Promise<string> {
    const root = base || 'product';
    let slug = root;
    for (let i = 2; await this.prisma.product.count({ where: { slug } }); i++) slug = `${root}-${i}`;
    return slug;
  }
}

