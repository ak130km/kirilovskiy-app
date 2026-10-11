import { Injectable } from '@nestjs/common';
import type { CartItemInput, CartQuoteDto, CartQuoteItemDto, FulfillmentType } from '@kirilovskiy/shared';
import { formatRub } from '@kirilovskiy/shared';
import type { DeliveryZone, Product, ProductImage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isProductAvailable } from '../catalog/catalog.mapper';
import { PromoEvaluation, PromoService } from '../promo/promo.service';
import { SettingsService } from '../settings/settings.service';

export interface QuoteInput {
  items: CartItemInput[];
  fulfillmentType?: FulfillmentType;
  deliveryZoneId?: string;
  promoCode?: string;
  customerId?: string | null;
}

export interface QuoteResult {
  quote: CartQuoteDto;
  products: Map<string, Product & { images: ProductImage[] }>;
  zone: DeliveryZone | null;
  promo: PromoEvaluation | null;
}

/** Объединяет одинаковые товары и отбрасывает некорректные количества */
export function mergeItems(items: CartItemInput[]): CartItemInput[] {
  const map = new Map<string, number>();
  for (const item of items) {
    if (item.quantity > 0) map.set(item.productId, Math.min(50, (map.get(item.productId) ?? 0) + item.quantity));
  }
  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

/** Стоимость доставки с учётом порога бесплатной доставки */
export function deliveryPrice(zone: Pick<DeliveryZone, 'price' | 'freeFromAmount'>, subtotal: number): number {
  if (zone.freeFromAmount !== null && subtotal >= zone.freeFromAmount) return 0;
  return zone.price;
}

/**
 * Единственное место, где считаются деньги: корзина в приложении, оформление и создание заказа
 * используют один и тот же расчёт. Клиент присылает только id товаров и количество.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promoService: PromoService,
    private readonly settings: SettingsService,
  ) {}

  async quote(input: QuoteInput): Promise<QuoteResult> {
    const store = await this.settings.getStore();
    const items = mergeItems(input.items);
    const products = new Map(
      (
        await this.prisma.product.findMany({
          where: { id: { in: items.map((i) => i.productId) } },
          include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, category: true },
        })
      ).map((p) => [p.id, p]),
    );

    const problems: string[] = [];
    const quoteItems: CartQuoteItemDto[] = [];
    let subtotal = 0;
    let leadTimeHours = 0;

    for (const item of items) {
      const p = products.get(item.productId);
      if (!p) {
        quoteItems.push({
          productId: item.productId,
          name: 'Товар недоступен',
          imageUrl: null,
          unitPrice: 0,
          weightGrams: 0,
          quantity: item.quantity,
          totalAmount: 0,
          isAvailable: false,
          unavailableReason: 'Товар больше не продаётся',
        });
        continue;
      }
      const available = isProductAvailable(p) && p.category.isActive;
      const unavailableReason = available
        ? null
        : p.inStopList && p.isActive && !p.archivedAt
          ? 'Временно нет в наличии'
          : 'Товар больше не продаётся';
      const total = p.price * item.quantity;
      if (available) {
        subtotal += total;
        leadTimeHours = Math.max(leadTimeHours, p.leadTimeHours);
      }
      quoteItems.push({
        productId: p.id,
        name: p.name,
        imageUrl: p.images[0]?.url ?? null,
        unitPrice: p.price,
        weightGrams: p.weightGrams,
        quantity: item.quantity,
        totalAmount: total,
        isAvailable: available,
        unavailableReason,
      });
    }

    if (!store.acceptingOrders) problems.push(store.acceptingOrdersMessage);
    if (items.length === 0) problems.push('Корзина пуста');
    if (quoteItems.some((i) => !i.isAvailable)) {
      problems.push('Некоторые товары недоступны — удалите их из корзины');
    }

    let zone: DeliveryZone | null = null;
    let deliveryAmount = 0;
    if (input.fulfillmentType === 'DELIVERY') {
      if (input.deliveryZoneId) {
        zone = await this.prisma.deliveryZone.findFirst({ where: { id: input.deliveryZoneId, isActive: true } });
        if (!zone) problems.push('Зона доставки недоступна — выберите другую');
      }
      if (zone) deliveryAmount = deliveryPrice(zone, subtotal);
    }

    const minOrderAmount = Math.max(store.minOrderAmount, zone?.minOrderAmount ?? 0);
    if (subtotal > 0 && subtotal < minOrderAmount) {
      problems.push(`Минимальная сумма заказа — ${formatRub(minOrderAmount)}`);
    }

    let promo: PromoEvaluation | null = null;
    if (input.promoCode?.trim()) {
      promo = await this.promoService.evaluate(input.promoCode, subtotal, input.customerId);
    }
    const discountAmount = promo?.valid ? promo.discountAmount : 0;

    const quote: CartQuoteDto = {
      items: quoteItems,
      subtotalAmount: subtotal,
      deliveryAmount,
      discountAmount,
      totalAmount: subtotal - discountAmount + deliveryAmount,
      minOrderAmount,
      leadTimeHours,
      promoCode: promo ? { code: promo.code, applied: promo.valid, message: promo.message } : null,
      canCheckout: problems.length === 0,
      problems,
    };
    return { quote, products, zone, promo };
  }
}
