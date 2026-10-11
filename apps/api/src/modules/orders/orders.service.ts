import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  AdminOrderCounts,
  AdminOrderDto,
  AdminOrderListItemDto,
  CreateOrderResponse,
  OrderDto,
  Paginated,
  ReorderResponse,
} from '@kirilovskiy/shared';
import {
  ACTIVE_ORDER_STATUSES,
  canTransition,
  formatRub,
  normalizePhone,
  ORDER_STATUS_LABELS,
} from '@kirilovskiy/shared';
import { ActorType, OrderStatus, Prisma } from '@prisma/client';
import type { AuthCustomer, AuthStaff } from '../../common/auth/auth.types';
import { OrderEvents, type OrderEventPayload, type OrderStatusChangedPayload } from '../../common/events';
import { isUuid } from '../../common/order-access';
import { randomToken, safeEqual, sha256 } from '../../common/utils/crypto';
import { isValidIsoDate, toDbDate } from '../../common/utils/moscow-time';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { isProductAvailable } from '../catalog/catalog.mapper';
import { DeliveryService } from '../delivery/delivery.service';
import { PaymentsService } from '../payments/payments.service';
import { PricingService } from '../pricing/pricing.service';
import { SettingsService } from '../settings/settings.service';
import { AdminOrdersQueryDto, CreateOrderDto, GuestOrderRefDto } from './orders.dto';
import {
  adminListInclude,
  adminOrderInclude,
  orderInclude,
  toAdminListItem,
  toAdminOrderDto,
  toOrderDto,
} from './orders.mapper';

export interface OrderActor {
  actor: ActorType;
  staff?: AuthStaff | null;
  ip?: string | null;
}

const TAB_STATUSES: Record<string, OrderStatus[] | undefined> = {
  new: ['NEW'],
  active: ['CONFIRMED', 'PREPARING'],
  ready: ['READY', 'HANDED_TO_COURIER'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED'],
  all: undefined,
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly delivery: DeliveryService,
    private readonly settings: SettingsService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ─────────── Клиент ───────────

  async create(dto: CreateOrderDto, customer?: AuthCustomer): Promise<CreateOrderResponse> {
    const phone = normalizePhone(dto.customerPhone);
    if (!phone) throw new BadRequestException('Укажите российский мобильный номер в формате +7 9XX XXX-XX-XX');
    if (!isValidIsoDate(dto.deliveryDate)) throw new BadRequestException('Выберите дату');

    const isDelivery = dto.fulfillmentType === 'DELIVERY';
    if (isDelivery && !dto.deliveryZoneId) throw new BadRequestException('Выберите зону доставки');
    if (isDelivery && (!dto.address || dto.address.length < 5)) {
      throw new BadRequestException('Укажите адрес доставки: улицу и дом');
    }

    const { quote, products, zone, promo } = await this.pricing.quote({
      items: dto.items,
      fulfillmentType: dto.fulfillmentType,
      deliveryZoneId: dto.deliveryZoneId,
      promoCode: dto.promoCode,
      customerId: customer?.id,
    });
    if (!quote.canCheckout) throw new BadRequestException(quote.problems.join('. '));
    if (dto.promoCode && promo && !promo.valid) throw new BadRequestException(`Промокод: ${promo.message}`);

    const deviceId =
      dto.deviceId && (await this.prisma.device.count({ where: { id: dto.deviceId } })) ? dto.deviceId : null;
    const accessToken = randomToken();

    const create = () =>
      this.prisma.$transaction(
        async (tx) => {
          // Повторная проверка интервала внутри транзакции защищает от переполнения слота
          const slot = await this.delivery.assertSlotAvailable(
            {
              type: dto.fulfillmentType,
              date: dto.deliveryDate,
              timeSlotId: dto.timeSlotId,
              leadHours: quote.leadTimeHours,
            },
            tx,
          );

          if (promo?.valid && promo.promo) {
            const updated = await tx.promoCode.updateMany({
              where: {
                id: promo.promo.id,
                OR: [{ usageLimit: null }, { usedCount: { lt: promo.promo.usageLimit ?? 0 } }],
              },
              data: { usedCount: { increment: 1 } },
            });
            if (!updated.count) throw new BadRequestException('Промокод больше не действует');
          }

          return tx.order.create({
            data: {
              accessTokenHash: sha256(accessToken),
              customerId: customer?.id ?? null,
              deviceId,
              customerName: dto.customerName,
              customerPhone: phone,
              comment: dto.comment ?? null,
              fulfillmentType: dto.fulfillmentType,
              deliveryZoneId: isDelivery ? zone?.id : null,
              address: isDelivery ? dto.address : null,
              apartment: isDelivery ? dto.apartment : null,
              entrance: isDelivery ? dto.entrance : null,
              floor: isDelivery ? dto.floor : null,
              intercom: isDelivery ? dto.intercom : null,
              latitude: isDelivery ? dto.latitude : null,
              longitude: isDelivery ? dto.longitude : null,
              deliveryDate: toDbDate(dto.deliveryDate),
              timeSlotId: slot.id,
              slotStartMinutes: slot.startMinutes,
              slotEndMinutes: slot.endMinutes,
              paymentMethod: dto.paymentMethod,
              subtotalAmount: quote.subtotalAmount,
              deliveryAmount: quote.deliveryAmount,
              discountAmount: quote.discountAmount,
              totalAmount: quote.totalAmount,
              promoCodeId: promo?.valid ? promo.promo?.id : null,
              promoCodeValue: promo?.valid ? promo.code : null,
              items: {
                create: quote.items.map((i) => ({
                  productId: i.productId,
                  productName: i.name,
                  imageUrl: products.get(i.productId)?.images[0]?.url ?? null,
                  unitPrice: i.unitPrice,
                  weightGrams: i.weightGrams,
                  quantity: i.quantity,
                  totalAmount: i.totalAmount,
                })),
              },
              statusHistory: { create: { toStatus: 'NEW', actor: 'CUSTOMER' } },
            },
            include: orderInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    let order;
    try {
      order = await create();
    } catch (e) {
      // Конфликт сериализации при одновременных заказах на один интервал — одна повторная попытка
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') order = await create();
      else throw e;
    }

    if (customer) {
      await this.prisma.customer.updateMany({
        where: { id: customer.id, name: null },
        data: { name: dto.customerName },
      });
      if (deviceId) await this.prisma.device.update({ where: { id: deviceId }, data: { customerId: customer.id } });
    }

    this.logger.log(`Создан заказ №${order.number} на ${formatRub(order.totalAmount)}`);
    this.events.emit(OrderEvents.CREATED, { orderId: order.id } satisfies OrderEventPayload);
    return { order: toOrderDto(order, await this.settings.getStore()), accessToken };
  }

  async getForClient(id: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Заказ не найден');
    return toOrderDto(order, await this.settings.getStore());
  }

  /** Заказы гостя по сохранённым на устройстве токенам */
  async findByTokens(refs: GuestOrderRefDto[]): Promise<OrderDto[]> {
    const valid = refs.filter((r) => isUuid(r.id));
    if (!valid.length) return [];
    const rows = await this.prisma.order.findMany({
      where: { id: { in: valid.map((r) => r.id) } },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
    const store = await this.settings.getStore();
    return rows
      .filter((o) => valid.some((r) => r.id === o.id && safeEqual(sha256(r.accessToken), o.accessTokenHash)))
      .map((o) => toOrderDto(o, store));
  }

  async listForCustomer(customerId: string): Promise<OrderDto[]> {
    const rows = await this.prisma.order.findMany({
      where: { customerId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const store = await this.settings.getStore();
    return rows.map((o) => toOrderDto(o, store));
  }

  /** «Повторить заказ»: позиции с актуальными ценами и доступностью */
  async reorder(id: string): Promise<ReorderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, category: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    const unavailable: string[] = [];
    const items = order.items.flatMap((i) => {
      const p = i.product;
      if (!p) {
        unavailable.push(i.productName);
        return [];
      }
      const isAvailable = isProductAvailable(p) && p.category.isActive;
      if (!isAvailable) unavailable.push(p.name);
      return [
        {
          productId: p.id,
          name: p.name,
          imageUrl: p.images[0]?.url ?? null,
          price: p.price,
          quantity: i.quantity,
          isAvailable,
        },
      ];
    });
    return { items, unavailable };
  }

  // ─────────── Админка ───────────

  async adminList(q: AdminOrdersQueryDto): Promise<Paginated<AdminOrderListItemDto>> {
    const tab = q.tab ?? 'new';
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const search = q.search?.trim();
    const number = search && /^\d+$/.test(search) ? Number(search) : undefined;
    const digits = search?.replace(/\D/g, '');

    const where: Prisma.OrderWhereInput = {
      status: TAB_STATUSES[tab] ? { in: TAB_STATUSES[tab] } : undefined,
      deliveryDate: q.date ? toDbDate(q.date) : undefined,
      OR: search
        ? [
            ...(number && number < 2_147_483_647 ? [{ number }] : []),
            { customerName: { contains: search, mode: 'insensitive' as const } },
            ...(digits && digits.length >= 4 ? [{ customerPhone: { contains: digits.slice(-10) } }] : []),
            { address: { contains: search, mode: 'insensitive' as const } },
          ]
        : undefined,
    };
    // Рабочие вкладки — по времени выдачи, архивные — по дате создания
    const orderBy: Prisma.OrderOrderByWithRelationInput[] = ['new', 'active', 'ready'].includes(tab)
      ? [{ deliveryDate: 'asc' }, { slotStartMinutes: 'asc' }, { createdAt: 'asc' }]
      : [{ createdAt: 'desc' }];

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: adminListInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items: rows.map(toAdminListItem) };
  }

  async adminCounts(): Promise<AdminOrderCounts> {
    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
      _count: { _all: true },
    });
    const count = (statuses: OrderStatus[]) =>
      grouped.filter((g) => statuses.includes(g.status)).reduce((s, g) => s + g._count._all, 0);
    const unpaid = await this.prisma.order.count({
      where: { status: 'NEW', paymentStatus: { in: ['PENDING', 'FAILED'] } },
    });
    return {
      new: count(['NEW']),
      inProgress: count(['CONFIRMED', 'PREPARING']),
      ready: count(['READY', 'HANDED_TO_COURIER']),
      unpaid,
    };
  }

  async adminGet(id: string): Promise<AdminOrderDto> {
    if (!isUuid(id)) throw new NotFoundException('Заказ не найден');
    const order = await this.prisma.order.findUnique({ where: { id }, include: adminOrderInclude });
    if (!order) throw new NotFoundException('Заказ не найден');
    return toAdminOrderDto(order, await this.settings.getStore());
  }

  /** Смена статуса по статусной машине. Отмена — через cancel(). */
  async changeStatus(id: string, to: OrderStatus, by: OrderActor, comment?: string): Promise<void> {
    if (to === 'CANCELLED') {
      await this.cancel(id, comment || 'Отменён сотрудником', by);
      return;
    }
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status === to) return;
    if (!canTransition(order.status, to, order.fulfillmentType)) {
      throw new ConflictException(
        `Нельзя перевести заказ из статуса «${ORDER_STATUS_LABELS[order.status]}» в «${ORDER_STATUS_LABELS[to]}»`,
      );
    }
    if (to === 'CONFIRMED' && order.paymentStatus !== 'SUCCEEDED') {
      throw new ConflictException('Заказ ещё не оплачен — подтвердить можно только оплаченный заказ');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status: to,
          confirmedAt: to === 'CONFIRMED' ? now : undefined,
          completedAt: to === 'COMPLETED' ? now : undefined,
        },
      });
      if (!updated.count) throw new ConflictException('Статус заказа уже изменился. Обновите страницу.');
      await tx.orderStatusHistory.create({
        data: { orderId: id, fromStatus: order.status, toStatus: to, actor: by.actor, staffUserId: by.staff?.id, comment },
      });
    });

    if (by.staff) {
      await this.audit.log({
        staff: by.staff,
        ip: by.ip,
        action: 'order.status',
        entityType: 'order',
        entityId: id,
        summary: `Заказ №${order.number}: ${ORDER_STATUS_LABELS[order.status]} → ${ORDER_STATUS_LABELS[to]}`,
        changes: { status: { from: order.status, to } },
      });
    }
    this.events.emit(OrderEvents.STATUS_CHANGED, { orderId: id, from: order.status, to } satisfies OrderStatusChangedPayload);
  }

  /** Отмена заказа: возврат оплаты, возврат промокода, уведомления */
  async cancel(id: string, reason: string, by: OrderActor): Promise<{ refunded: boolean; refundError?: string }> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ConflictException(`Заказ уже в статусе «${ORDER_STATUS_LABELS[order.status]}»`);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: new Date() },
      });
      if (!updated.count) throw new ConflictException('Статус заказа уже изменился. Обновите страницу.');
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: 'CANCELLED',
          actor: by.actor,
          staffUserId: by.staff?.id,
          comment: reason,
        },
      });
      if (order.promoCodeId) {
        await tx.promoCode.updateMany({
          where: { id: order.promoCodeId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
    });

    const refund =
      order.paymentStatus === 'SUCCEEDED' ? await this.payments.refundOrder(id) : { refunded: false };

    if (by.staff) {
      await this.audit.log({
        staff: by.staff,
        ip: by.ip,
        action: 'order.cancel',
        entityType: 'order',
        entityId: id,
        summary:
          `Заказ №${order.number} отменён: ${reason}` +
          (refund.refunded ? ` (возврат ${formatRub(order.totalAmount)})` : '') +
          ('error' in refund && refund.error ? ' — ошибка возврата, требуется ручной возврат' : ''),
        changes: { status: { from: order.status, to: 'CANCELLED' } },
      });
    }
    this.events.emit(OrderEvents.CANCELLED, { orderId: id } satisfies OrderEventPayload);
    this.events.emit(OrderEvents.STATUS_CHANGED, {
      orderId: id,
      from: order.status,
      to: 'CANCELLED',
    } satisfies OrderStatusChangedPayload);
    return { refunded: refund.refunded, refundError: 'error' in refund ? refund.error : undefined };
  }

  /** Отмена заказов, не оплаченных за paymentTimeoutMinutes */
  async cancelExpiredUnpaid(): Promise<number> {
    const store = await this.settings.getStore();
    const deadline = new Date(Date.now() - store.paymentTimeoutMinutes * 60_000);
    const expired = await this.prisma.order.findMany({
      where: { status: 'NEW', paymentStatus: { in: ['PENDING', 'FAILED'] }, createdAt: { lt: deadline } },
      select: { id: true, number: true },
      take: 100,
    });
    for (const o of expired) {
      try {
        await this.cancel(o.id, 'Заказ не оплачен вовремя', { actor: 'SYSTEM' });
        this.logger.log(`Заказ №${o.number} отменён: не оплачен за ${store.paymentTimeoutMinutes} мин`);
      } catch (e) {
        this.logger.warn(`Не удалось отменить заказ №${o.number}: ${e}`);
      }
    }
    return expired.length;
  }
}
