import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { canTransition } from '@kirilovskiy/shared';
import type { AuthStaff } from '../../common/auth/auth.types';
import { OrderEvents, type OrderEventPayload } from '../../common/events';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IntegrationLogService } from '../integrations/integration-log.service';
import { OrdersService } from '../orders/orders.service';
import { COURIER_ADAPTER, COURIER_STATUS_LABELS, type CourierAdapter, type CourierClaim } from './adapters/courier-adapter';

const FINAL_STATUSES = ['delivered', 'delivered_finish', 'cancelled', 'cancelled_by_taxi', 'cancelled_with_payment', 'failed'];

@Injectable()
export class CourierService {
  private readonly logger = new Logger(CourierService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(COURIER_ADAPTER) private readonly adapter: CourierAdapter,
    private readonly integrations: IntegrationLogService,
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  /** Вызвать курьера для заказа с доставкой */
  async request(orderId: string, staff: AuthStaff, ip?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, courierDelivery: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.fulfillmentType !== 'DELIVERY') throw new ConflictException('Курьер нужен только для доставки');
    if (!['CONFIRMED', 'PREPARING', 'READY'].includes(order.status)) {
      throw new ConflictException('Курьера можно вызвать для подтверждённого заказа до передачи');
    }
    if (order.courierDelivery && !FINAL_STATUSES.includes(order.courierDelivery.status)) {
      throw new ConflictException('Курьер уже вызван');
    }

    let claim: CourierClaim;
    try {
      claim = await this.integrations.track(
        { provider: this.adapter.provider, operation: 'courier.create', orderId },
        () =>
          this.adapter.createClaim({
            orderId: order.id,
            orderNumber: order.number,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            address: order.address ?? '',
            apartment: order.apartment,
            entrance: order.entrance,
            floor: order.floor,
            intercom: order.intercom,
            comment: order.comment,
            latitude: order.latitude,
            longitude: order.longitude,
            totalAmount: order.totalAmount,
            items: order.items.map((i) => ({
              name: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              weightGrams: i.weightGrams,
            })),
          }),
      );
    } catch (e) {
      throw new ConflictException(`Не удалось вызвать курьера: ${e instanceof Error ? e.message : e}`);
    }

    const data = {
      provider: this.adapter.provider,
      externalId: claim.externalId,
      status: claim.status,
      price: claim.price ?? null,
      trackingUrl: claim.trackingUrl ?? null,
      courierName: claim.courierName ?? null,
      courierPhone: claim.courierPhone ?? null,
      raw: JSON.parse(JSON.stringify(claim.raw ?? null)),
    };
    await this.prisma.courierDelivery.upsert({
      where: { orderId },
      create: { orderId, ...data },
      update: data,
    });
    await this.audit.log({
      staff,
      ip,
      action: 'courier.request',
      entityType: 'order',
      entityId: orderId,
      summary: `Вызван курьер для заказа №${order.number} (${this.adapter.provider})`,
    });
    return this.orders.adminGet(orderId);
  }

  /** Обновить статус заявки и перевести заказ, если курьер забрал или доставил его */
  async refresh(orderId: string) {
    const delivery = await this.prisma.courierDelivery.findUnique({ where: { orderId }, include: { order: true } });
    if (!delivery?.externalId) throw new NotFoundException('Курьер не вызывался');
    const claim = await this.adapter.getClaim(delivery.externalId);
    await this.prisma.courierDelivery.update({
      where: { orderId },
      data: {
        status: claim.status,
        price: claim.price ?? delivery.price,
        courierName: claim.courierName ?? delivery.courierName,
        courierPhone: claim.courierPhone ?? delivery.courierPhone,
        trackingUrl: claim.trackingUrl ?? delivery.trackingUrl,
      },
    });

    const order = delivery.order;
    const comment = COURIER_STATUS_LABELS[claim.status] ?? claim.status;
    // Курьер забрал заказ раньше, чем сотрудник отметил «Готов», — проводим через READY
    if (claim.orderStatus && order.status === 'PREPARING') {
      await this.orders.changeStatus(orderId, 'READY', { actor: 'INTEGRATION' }, comment);
      order.status = 'READY';
    }
    if (claim.orderStatus === 'COMPLETED' && order.status === 'READY') {
      await this.orders.changeStatus(orderId, 'HANDED_TO_COURIER', { actor: 'INTEGRATION' }, comment);
      order.status = 'HANDED_TO_COURIER';
    }
    if (claim.orderStatus && canTransition(order.status, claim.orderStatus, order.fulfillmentType)) {
      await this.orders.changeStatus(orderId, claim.orderStatus, { actor: 'INTEGRATION' }, comment);
    }
    return this.orders.adminGet(orderId);
  }

  /** Опрос активных заявок раз в минуту (у тестового адаптера и у Яндекса нет гарантии webhook) */
  @Cron(CronExpression.EVERY_MINUTE)
  async pollActive() {
    const active = await this.prisma.courierDelivery.findMany({
      where: { status: { notIn: FINAL_STATUSES }, order: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
      select: { orderId: true },
      take: 50,
    });
    for (const { orderId } of active) {
      try {
        await this.refresh(orderId);
      } catch (e) {
        this.logger.warn(`Не удалось обновить доставку заказа ${orderId}: ${e}`);
      }
    }
  }

  /** При отмене заказа отменяем вызов курьера */
  @OnEvent(OrderEvents.CANCELLED)
  async onCancelled({ orderId }: OrderEventPayload) {
    const delivery = await this.prisma.courierDelivery.findUnique({ where: { orderId } });
    if (!delivery?.externalId || FINAL_STATUSES.includes(delivery.status)) return;
    try {
      await this.integrations.track(
        { provider: delivery.provider, operation: 'courier.cancel', orderId },
        () => this.adapter.cancelClaim(delivery.externalId!),
      );
      await this.prisma.courierDelivery.update({ where: { orderId }, data: { status: 'cancelled' } });
    } catch (e) {
      this.logger.warn(`Не удалось отменить курьера для заказа ${orderId}: ${e}`);
    }
  }
}
