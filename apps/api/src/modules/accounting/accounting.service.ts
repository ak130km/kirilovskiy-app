import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { formatSlot } from '@kirilovskiy/shared';
import type { AuthStaff } from '../../common/auth/auth.types';
import { OrderEvents, type OrderEventPayload } from '../../common/events';
import { fromDbDate } from '../../common/utils/moscow-time';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IntegrationLogService } from '../integrations/integration-log.service';
import { ACCOUNTING_ADAPTER, type AccountingAdapter, type AccountingOrder } from './adapters/accounting-adapter';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ACCOUNTING_ADAPTER) private readonly adapter: AccountingAdapter,
    private readonly integrations: IntegrationLogService,
    private readonly audit: AuditService,
  ) {}

  /** Оплаченный заказ выгружается в 1С */
  @OnEvent(OrderEvents.PAID, { async: true })
  async onPaid({ orderId }: OrderEventPayload) {
    const order = await this.load(orderId);
    if (!order) return;
    try {
      const res = await this.integrations.track(
        { provider: this.adapter.provider, operation: 'accounting.export', orderId },
        () => this.adapter.exportOrder(order),
      );
      if (res.documentId) {
        await this.prisma.order.update({ where: { id: orderId }, data: { accountingId: res.documentId } });
      }
    } catch (e) {
      this.logger.warn(`Выгрузка заказа №${order.number} в 1С не удалась: ${e}`);
    }
  }

  @OnEvent(OrderEvents.CANCELLED, { async: true })
  async onCancelled({ orderId }: OrderEventPayload) {
    const order = await this.load(orderId);
    if (!order?.paidAt) return; // неоплаченные заказы в 1С не выгружались
    try {
      await this.integrations.track(
        { provider: this.adapter.provider, operation: 'accounting.cancel', orderId },
        () => this.adapter.cancelOrder(order),
      );
    } catch (e) {
      this.logger.warn(`Отмена заказа №${order.number} в 1С не удалась: ${e}`);
    }
  }

  /** Загрузка цен и наличия из 1С по external_id номенклатуры */
  async syncCatalog(staff: AuthStaff, ip?: string) {
    const items = await this.integrations.track(
      { provider: this.adapter.provider, operation: 'accounting.catalog' },
      () => this.adapter.fetchCatalog(),
    );
    let updated = 0;
    for (const item of items) {
      const res = await this.prisma.product.updateMany({
        where: { externalId: item.externalId },
        data: {
          price: item.price,
          inStopList: item.inStock === undefined ? undefined : !item.inStock,
          stopListReason: item.inStock === false ? 'Нет в наличии (1С)' : undefined,
        },
      });
      updated += res.count;
    }
    await this.audit.log({
      staff,
      ip,
      action: 'accounting.sync',
      entityType: 'product',
      summary: `Синхронизация каталога с 1С: обновлено товаров ${updated}`,
    });
    return { provider: this.adapter.provider, received: items.length, updated };
  }

  private async load(orderId: string): Promise<(AccountingOrder & { paidAt: string | null }) | null> {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { externalId: true } } } } },
    });
    if (!o) return null;
    return {
      id: o.id,
      number: o.number,
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
      status: o.status,
      customer: { name: o.customerName, phone: o.customerPhone },
      fulfillmentType: o.fulfillmentType,
      deliveryDate: fromDbDate(o.deliveryDate),
      slot: formatSlot(o.slotStartMinutes, o.slotEndMinutes),
      address: o.address,
      comment: o.comment,
      paymentMethod: o.paymentMethod,
      items: o.items.map((i) => ({
        externalId: i.product?.externalId ?? null,
        name: i.productName,
        quantity: i.quantity,
        price: i.unitPrice,
        sum: i.totalAmount,
      })),
      subtotal: o.subtotalAmount,
      delivery: o.deliveryAmount,
      discount: o.discountAmount,
      total: o.totalAmount,
    };
  }
}
